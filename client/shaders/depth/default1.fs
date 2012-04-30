#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;

void main( void ) 
{
	// basic default, just show them as white
	gl_FragColor = vec4(1.0,1.0,1.0,1.0);
}
