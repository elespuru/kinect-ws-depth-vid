#!/usr/bin/env python

#
# Peter Elespuru
#

#
# RGB/video camera web socket streamer
# does conversion using OpenCV (also use of OpenCV opens up future potential uses as well)
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
    print 'sending: %d KB/sec' % (self.dataSent / self.tickGap / 1024)
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
    print 'broadcasting: %d KB/sec' % (self.dataSent / self.tickGap / 1024)
    self.tickSetup()
  
  def register(self, client):
    if not client in self.clients:
      print "registered client: " + client.peerstr
      self.clients.append(client)
  
  def unregister(self, client):
    if client in self.clients:
      print "unregistered client: " + client.peerstr
      self.clients.remove(client)
  
  def broadcast(self, msg, binary = False):
    self.dataSent += len(msg)
    for c in self.clients:
      c.sendMessage(msg, binary)


#
#
#
class KinectRGB:
  
  def __init__(self, wsFactory):
    self.wsFactory = wsFactory
    self.h = 480
    self.w = 632
    self.currentFrame = 0
    self.keyFrameEvery = 60

  # for testing without kinect available, just loop sending a single jpg over the channel
  def imgLoop(self):
    with open('test_frame.jpg','r+') as f:
        self.fileData = f.read()
    reactor.callFromThread(self.wsFactory.broadcast, self.fileData, True)
  
  def depthCallback(self, dev, depth, timestamp):
    self.lastDepth = depth
      
  def rgbCallback(self, dev, rgb, timestamp):
    frame_convert.video_cv(rgb)
    with open('frame.jpg','r+') as f:
        self.fileData = f.read()
    reactor.callFromThread(self.wsFactory.broadcast, self.fileData, True)
  
  def bodyCallback(self, *args):
    if not self.kinecting: raise freenect.Kill
  
  def runInOtherThread(self):
    self.kinecting = True
    if _test is True:
        reactor.callInThread(self.imgLoop) # for testing w/out kinect
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
url  = sys.argv[2] if len(sys.argv) > 2 else 'ws://localhost:9001'

signal.signal(signal.SIGINT, signalHandler)
print '>>> %s --- Press Ctrl-C to stop <<<' % url

factory = BroadcastServerFactory(url) if func == 'server' else SendClientFactory(url)
kinect = KinectRGB(factory)
kinect.runInOtherThread()
reactor.run()
