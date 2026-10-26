# Asahikawa WebXR: generic right-hand-drive AT prototype

Open this directory on the existing HTTPS site in a WebXR-compatible Quest browser, then choose **Quest VRに入る**. This is a native immersive 3D WebXR session with headset pose and per-eye projections managed by bundled Three.js r160, not a flat browser panel. Quest hardware has not been tested.

## Controls and mechanical sequence

- Sit facing forward before entry. Right stick click resets seated head position/yaw and stops. Head roll/pitch are not driven by the vehicle or artificially delayed.
- Point at cockpit switches with either controller and press A/X to select. Hold the left trigger (brake), choose 操作開始, fasten the belt, press 始動 while braking in P/N, select D/R while stopped and braking, then release the parking brake while braking. Release the brake for creep; press the right trigger gradually for acceleration.
- Grip near the steering rim and move your hand around it. A separate steering parent turns the front wheels; a child rolls each tire along its axle. One hand owns steering at a time; release and regrip to reposition. Steering ratio 14:1 and limits are estimates, not a measured car. There is no physical rim resistance or force feedback.
- Grip the shift lever and move it forward/back through P/R/N/D detents. The adjacent labeled pads are an alternative selection method. Moving shifts into P/R/D are rejected; P release needs engine and brake. N remains available, matching the pre-existing AT model. This is a prototype interlock, not a guarantee of any particular car's mechanism.
- Left trigger = continuous brake and right trigger = continuous accelerator. These are substitutes for foot pedals. The visible pedals follow the simulated pedal positions. Braking overrides drive torque.
- Parking brake, belt, engine, turn-signal lever controls, hazard, lights and OFF/LOW/HIGH wipers change the same vehicle state used by dynamics and displays. Turn signals return off after a sufficiently large turn and recenter. Lights illuminate the scene and dashboard; wipers move when the engine is on. Rain removal, battery discharge, optical mirror effects and measured drivetrain/suspension physics are not simulated.
- B or the red cockpit button is an immediate safety stop, separate from ordinary braking. Y exits VR. Input/controller/head tracking loss, reference-space reset, hidden session, long frame gaps, collision/road boundaries and trial duration stop the simulation. Recovery never intentionally resumes driving; release A/X, release accelerator, hold brake and deliberately select 操作開始. Parking is applied by a safety stop.

## Desktop inspection and regression tests

The original browser and diagnostic routes remain available. This VR route also offers a desktop cockpit view and explicitly labeled analog inspection sliders, plus the original AT buttons. The VR headset path bypasses the 2D mirror and held-scenery comparison modes. VR controls do not automatically fasten the belt, start the engine or release parking.

Run `node tests/wheels-xr.cjs` from the repository root. Tests exercise actual bundled Three.js wheel matrices, both wheel sides, forward/reverse and left/right steering, and the actual VR adapter against a simulated XR runtime. They cover ray selection, rim/lever grabbing, AT interlocks, analog pedals and safety lifecycle. These do not certify real Quest rendering, controller ergonomics, frame pacing, binocular comfort or tracking behavior. No driving-training or motion-sickness-reduction claim is made.

Build marker: `wheel-xr-at-20261026-1`.
