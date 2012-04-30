#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;

void main( void ) 
{
	vec3 blue = vec3(0.0, 0.0, 1.0);
				
	// alpha blended blue only
	vec4 cB = vec4(blue, smoothstep( 8000.0, -8000.0, gl_FragCoord.z / gl_FragCoord.w ));
				
	// define which of the colors to use for the fragment from the options above
	gl_FragColor = vec4(cB);
}
