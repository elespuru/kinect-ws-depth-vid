/*
 *
 *  Peter R. Elespuru
 *
 *  modified from:
 *  http://www.geeks3d.com/20101029/shader-library-pixelation-post-processing-effect-glsl/
 */
	 
uniform sampler2D img;
varying vec2 vUv;

void main() {
	
 float dx = 5.*(1./640.);
 float dy = 3.*(1./480.);
 
 vec2 coord = vec2(dx*floor(vUv.x/dx), dy*floor(vUv.y/dy));
 gl_FragColor = texture2D(img, coord);

}
 
