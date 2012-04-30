#!/usr/bin/env python

#
# Peter Elespuru
#

#
# combined depth and RGB/video camera web socket streamer does conversion using OpenCV 
# (which also opens up use of OpenCV for future potential uses as well)
#

import sys
sys.path.insert(0, "/usr/local/lib/python2.7/site-packages/")

import  signal, numpy, freenect, pylzma, time, frame_convert, cv
from twisted.internet import reactor, threads, ssl
from twisted.web.client import WebClientContextFactory
from autobahn.websocket import WebSocketServerFactory, WebSocketServerProtocol, listenWS, WebSocketClientFactory, WebSocketClientProtocol, connectWS

_test = False

#
#
#
class SendClientProtocol(WebSocketClientProtocol):

  def onOpen(self):
    print 'connection opened'
    self.factory.register(self)
    
  def connectionLost(self, reason):
    print 'connection lost'
    WebSocketClientProtocol.connectionLost(self, reason)
    self.factory.unregister(self)
    reactor.callLater(2, self.factory.connect)
    
    
#
#
#
class SendClientFactory(WebSocketClientFactory):
  
  protocol = SendClientProtocol

  def __init__(self, url):
    WebSocketClientFactory.__init__(self, url)
    
    self.protocolInstance = None
    self.tickGap = 5
    self.tickSetup()
    
    self.connect()
  
  def connect(self):
    contextFactory = ssl.ClientContextFactory()  # necessary for SSL; harmless otherwise
    connectWS(self, contextFactory)
    
  def tickSetup(self):
    self.dataSent = 0
    reactor.callLater(self.tickGap, self.tick)

  def tick(self):
    print '%s sending: %d KB/sec' % (self.url, self.dataSent / self.tickGap / 1024)
    self.tickSetup()

  def register(self, protocolInstance):
    self.protocolInstance = protocolInstance
    
  def unregister(self, protocolInstance):
    self.protocolInstance = None
  
  def broadcast(self, msg, binary):
    self.dataSent += len(msg)
    if self.protocolInstance == None:
      return
    self.protocolInstance.sendMessage(msg, binary)


#
#
#
class BroadcastServerProtocol(WebSocketServerProtocol):
  
  def onOpen(self):
    self.factory.register(self)
  
  def connectionLost(self, reason):
    WebSocketServerProtocol.connectionLost(self, reason)
    self.factory.unregister(self)


#
#
#
class BroadcastServerFactory(WebSocketServerFactory):
  
  protocol = BroadcastServerProtocol
  
  def __init__(self, url):
    WebSocketServerFactory.__init__(self, url)
    self.clients = []
    self.tickGap = 5
    self.tickSetup()
    listenWS(self)
    
  def tickSetup(self):
    self.dataSent = 0
    reactor.callLater(self.tickGap, self.tick)
  
  def tick(self):
    print '%s broadcasting: %d KB/sec' % (self.url, self.dataSent / self.tickGap / 1024)
    self.tickSetup()
  
  def register(self, client):
    if not client in self.clients:
      print "%s registered client: %s" % (self.url, client.peerstr)
      self.clients.append(client)
  
  def unregister(self, client):
    if client in self.clients:
      print "%s unregistered client: " % (self.url, client.peerstr) 
      self.clients.remove(client)
  
  def broadcast(self, msg, binary = False):
    self.dataSent += len(msg)
    for c in self.clients:
      c.sendMessage(msg, binary)


#
#
#
class Kinect:
  
  def __init__(self, wsFactory, wsFactory2):
    self.wsFactory = wsFactory
    self.wsFactory2 = wsFactory2
    self.fileData1 = None
    self.fileData2 = None
    
    self.useEvery = 4 #4
    self.h = 480 / self.useEvery
    self.w = 632 / self.useEvery
    
    self.useCols, self.useRows = numpy.indices((self.h, self.w))
    self.useCols *= self.useEvery
    self.useRows *= self.useEvery
    
    self.pixelDiffs = False
    
    self.medianOf = 3  # must be odd, or we'll get artefacts; 3 or 5 are the sweet spot
    zeros = numpy.zeros((self.h, self.w))
    self.depths = []
    
    for i in range(self.medianOf - 1):
      self.depths.append(zeros)
    
    self.currentFrame = 0
    self.keyFrameEvery = 60
    
  def testDepth(self):
    while True:
        with open('test_depth.bin','rb+') as f:
            self.fileData1 = f.read()
        reactor.callFromThread(self.wsFactory.broadcast, self.fileData1, True)
        time.sleep(1)

  def testRGB(self):
    while True:
        with open('test_frame.jpg','r+') as f:
            self.fileData2 = f.read()
        reactor.callFromThread(self.wsFactory2.broadcast, self.fileData2, True)
        time.sleep(1)

  def depthCallback(self, dev, depth, timestamp):      
    # resize grid
    depth0 = depth[self.useCols, self.useRows]
    
    # median of this + previous frames: reduces noise, and greatly improves compression on similar frames
    if self.medianOf > 1:
      self.depths.insert(0, depth0)
      depth = numpy.median(numpy.dstack(self.depths), axis = 2).astype(numpy.int16)
      self.depths.pop()
    else:
      depth = depth0
    
    # flip x axis so the orientation is correct
    depth = numpy.fliplr(depth)
    
    # rescale depths
    numpy.clip(depth, 0, 2 ** 10 - 1, depth)
    depth >>= 2
    
    # calculate quadrant averages (used to pan camera; could otherwise be done in JS)
    h, w = self.h, self.w
    halfH, halfW = h / 2, w / 2
    qtl = numpy.mean(depth[0:halfH, 0:halfW])
    qtr = numpy.mean(depth[0:halfH, halfW:w])
    qbl = numpy.mean(depth[halfH:h, 0:halfW])
    qbr = numpy.mean(depth[halfH:h, halfW:w])
    
    depth = depth.ravel()  # 1-D version
        
    # calculate diff from last frame (unless it's a keyframe)
    keyFrame = self.currentFrame == 0
    diffDepth = depth if keyFrame else depth - self.lastDepth
    
    # optionally produce pixel diffs (oddly, pixel diffing seems to *increase* compressed data size)
    if self.pixelDiffs:
      diffDepth = numpy.concatenate(([diffDepth[0]], numpy.diff(diffDepth)))
   
    # smush data together
    data = numpy.concatenate(([keyFrame, qtl, qtr, qbl, qbr], diffDepth % 256))
    
    # compress and broadcast
    crunchedData = pylzma.compress(data.astype(numpy.uint8), dictionary = 18)  # default: 23 -> 2 ** 23 -> 8MB

#   write out test data
#    ff = open('/tmp/test_depth.bin', 'ab')
#    ff.write(crunchedData)
#    ff.close()    

    reactor.callFromThread(self.wsFactory.broadcast, crunchedData, True)
    
    # setup for next frame
    self.lastDepth = depth
    self.currentFrame += 1
    self.currentFrame %= self.keyFrameEvery

  def rgbCallback(self, dev, rgb, timestamp):
    frame_convert.video_cv(rgb)
    # FIXME:
    # for now, pass by file to the streamer, there's gotta be a way to get jpg out of 
    # opencv without writing to file, but didn't have time to sort it out, for now this
    # works, just less elegant than I'd prefer... if time at the end I'll revisit and figure
    # out a better way to handle this
    with open('frame.jpg','r+') as f:
        self.fileData = f.read()
    reactor.callFromThread(self.wsFactory2.broadcast, self.fileData, True)
  
  def bodyCallback(self, *args):
    if not self.kinecting: raise freenect.Kill
  
  def runInOtherThread(self):
    self.kinecting = True
    if _test is True:
        reactor.callInThread(self.testDepth)
        reactor.callInThread(self.testRGB)
    else:
        reactor.callInThread(freenect.runloop, depth = self.depthCallback, video = self.rgbCallback, body = self.bodyCallback)
  
  def stop(self):
    self.kinecting = False


#
#
#
def signalHandler(signum, frame):
  kinect.stop()
  reactor.stop()

func = sys.argv[1] if len(sys.argv) > 1 else 'server'
url  = sys.argv[2] if len(sys.argv) > 2 else 'ws://localhost:9000'
url2 = sys.argv[3] if len(sys.argv) > 3 else 'ws://localhost:9001'

signal.signal(signal.SIGINT, signalHandler)
print '>>> %s, %s --- Press Ctrl-C to stop <<<' % (url, url2)

factory = BroadcastServerFactory(url) if func == 'server' else SendClientFactory(url)
factory2 = BroadcastServerFactory(url2) if func == 'server' else SendClientFactory(url2)
kinect = Kinect(factory, factory2)
kinect.runInOtherThread()
reactor.run()
