#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;

void main( void ) 
{
	vec3 red = vec3(1.0, 0.0, 0.1);
				
	// alpha blended red only
	vec4 cR = vec4(red, smoothstep( 8000.0, -8000.0, gl_FragCoord.z / gl_FragCoord.w ));
				
	// define which of the colors to use for the fragment from the options above
	gl_FragColor = vec4(cR);
}
