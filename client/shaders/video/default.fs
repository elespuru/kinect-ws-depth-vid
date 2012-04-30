#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D img;

varying vec2 vUv;

void main( void ) 
{
	// noop pass through
	gl_FragColor = texture2D(img, vUv);
}
