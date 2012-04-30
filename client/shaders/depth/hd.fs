#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;
varying float sd;
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

vec3 heat( float t )
{
	vec3 rgb = vec3(1.0, 0.0, 0.0);
	float n = 100.0;   // nearest
	float f = -1000.0;  // farthest
	float z = t;
	rgb.g = smoothstep(n, f, t);
	return rgb;
}

void main( void ) 
{	
	// heat map alpha blended color
	float d = gl_FragCoord.z / gl_FragCoord.w;
	vec4 cH = vec4(heat(depth), alpha(depth));
	gl_FragColor = vec4(cH);
}
