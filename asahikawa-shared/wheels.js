/* Shared axle animation: car +Z forward, +X left, +Y up. */
(function(root){
 const radius=.37;
 function create(THREE,parent){
  const all=[],front=[];
  for(const x of [-.92,.92])for(const z of [-1.35,1.35]){
   const steer=new THREE.Group();steer.position.set(x,.4,z);
   const spin=new THREE.Group();steer.add(spin);
   const tire=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.22,12),new THREE.MeshStandardMaterial({color:0x182029}));
   // Bake the cylinder Y axis onto X. Steering and rolling never share an Euler.
   tire.geometry.rotateZ(Math.PI/2);spin.add(tire);
   parent.add(steer);all.push(spin);if(z>0)front.push(steer);
  }
  return {all,front};
 }
 function advance(s,distance){s.wheelTravel=(s.wheelTravel||0)+distance;}
 function update(wheels,s){for(const w of wheels.all)w.rotation.x=(s.wheelTravel||0)/radius;for(const w of wheels.front)w.rotation.y=s.steer;}
 root.AsahikawaWheels={radius,create,advance,update};
})(globalThis);

