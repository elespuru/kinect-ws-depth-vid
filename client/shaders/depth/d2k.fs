#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;
varying float depth;

float alpha(float val) 
{
	float a;
	
	if ( val > -800.0 ) {
		a = smoothstep( -2000.0, 2000.0, val);
	} else {
		a = 0.0;
	}
	
	return a;
}

void main( void ) 
{
	gl_FragColor = vec4( 1.0, 1.0, 1.0, alpha(depth) );
}
