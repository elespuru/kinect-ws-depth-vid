varying vec2 vUv;
varying float depth;
	
void main( void )
{
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = 3.0;
	depth = position.z;
}
