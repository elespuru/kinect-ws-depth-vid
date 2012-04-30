Summary:
------------------------------------------------------------------------------
This project is a fork of George MacKerron's Kinect depthcam, which adds
streaming and visualization of the video camera, GLSL shader post-processing 
to both data streams, a dat.GUI drop down for shader selection, and dynamic
loading of shader .vs and .fs files via AJAX.

Sample video of Depth features:
http://youtu.be/a8-CCkxisbA

Sample video of RGB/video features:
http://youtu.be/Q53j1u2fAbc

In addition to George's work, this project utilizes: node.js, Three.js, OpenCV, 
libfreenect and a number of GLSL shaders ported from various sources online 
(attributions in code).

The depth and rgb stream servers provide web sockets, and the content server
is based on node.js, but could just as easily be your favorite web server.

I have hooks in the content server to serve up WebM content for use/viewing
when a Kinect isn't available, but haven't gotten around to coding that up yet...

Anyhow, to get it running...

(1) Make sure you have all pre-reqs installed (details below)
(2) Hook up your Kinect via USB
(3) ./serve_depth_and_rgb
(4) ./serve_content
(5) View http://127.0.0.1:9797/redpill.html for video and http://127.0.0.1:9797/bluepill.html for depth
(6) Use the drop down menu to apply a shader of your choice in the visualizers


Prerequisite Installation: 
------------------------------------------------------------------------------
You must install the kinect/data related and web content related prerequisites,
however, since node.js is only being used to serve static web content at the
moment, you could also use any other web server (apache, lighttpd, etc...) 
instead if you wish. At some point, I intend to serve WebM and proxy the 
websocket data from the Python code through Node.js, at which point that will
no longer be true, but for now...

# On Mac OS (Lion) with homebrew:

### Kinect/Data Related

brew install pkg-config
brew install xz
brew install opencv
sudo easy_install pylzma
sudo easy_install pip
sudo pip install cython
sudo pip install numpy
sudo pip install autobahn

cd /usr/local/Library/Formula
curl --insecure -O https://raw.github.com/OpenKinect/libfreenect/master/platform/osx/homebrew/libfreenect.rb
curl --insecure -O https://raw.github.com/OpenKinect/libfreenect/master/platform/osx/homebrew/libusb-freenect.rb
brew install libfreenect

cd ~/src
wget https://github.com/OpenKinect/libfreenect/tarball/master
tar xvzf master
cd OpenKinect-libfreenect-bac62d0/wrappers/python
sudo python setup.py install

### Web Content/Node.js Related

# download and install node
http://nodejs.org/#download

## install express and websocket for node
# websocket
npm install websocket

## express
npm install express
 