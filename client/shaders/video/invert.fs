#ifdef GL_ES
precision highp float;
#endif
	
uniform sampler2D img;

varying vec2 vUv;

void main( void ) 
{
	vec4 textureColor = texture2D(img, vUv);
	gl_FragColor = vec4(1.0 - textureColor.rgb, 1.0);;
}
