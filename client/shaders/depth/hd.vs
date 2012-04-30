varying vec2 vUv;
varying float depth;

void main( void )
{
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = 4.0;
	vec4 foo = modelViewMatrix * vec4(position, 1.0);
	depth = foo.z;
}
