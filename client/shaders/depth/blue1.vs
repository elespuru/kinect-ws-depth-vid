varying vec2 vUv;
	
void main( void )
{
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = 1.0;
}
