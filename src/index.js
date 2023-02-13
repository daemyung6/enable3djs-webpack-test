import {
    Project,
    PhysicsLoader,
    Scene3D,
    ExtendedObject3D,
    THREE,
    JoyStick,
    ThirdPersonControls,

} from 'enable3d';

/**
 * Is touch device?
 */
const isTouchDevice = 'ontouchstart' in window

class MainScene extends Scene3D {
    constructor() {
        super('MainScene')
    }


    init() {
        this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio / 2))

        this.canJump = true
        this.move = false

        this.moveTop = 0
        this.moveRight = 0

        this.event001 = false;
        this.isevent001 = false;

        this.text = {};

        this.meshArr = [];
        this.videoObjArr = [];
        this.isVideoOver = false;

        this.isMove = false;
        this.moveToPostion = {};
        this.moveToObj = null;

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        })

        this.lastPosition = {x: 0, y: 0, z: 0};
    }

    async preload() {
        const world = this.load.preload('world', './assets/glb/test-world.glb');
        const man = this.load.preload('man', './assets/glb/box_man.glb')

        await Promise.all([world, man])
    }

    async create() {
        const { lights } = await this.warpSpeed('-ground', '-orbitControls')

        const { hemisphereLight, ambientLight, directionalLight } = lights
        const intensity = 0.65
        hemisphereLight.intensity = intensity
        ambientLight.intensity = intensity
        directionalLight.intensity = intensity

        this.physics.debug.enable()

        let isDebug = false;
        const that = this;
        window.addEventListener('keydown', function (e) {
            if (e.key === 'e') {
                if (!isDebug) {
                    that.physics.debug.enable()
                }
                else {
                    that.physics.debug.disable()
                }
                isDebug = !isDebug;
            }
        })

        // this.log = document.createElement('div');
        // document.body.appendChild(this.log);
        // this.log.style.cssText = `
        //     position: absolute;
        //     padding: 10px;
        //     background: white;
        //     top: 0px;
        // `


        const addWorld = async () => {
            const object = await this.load.gltf('world')
            const scene = object.scenes[0];

            const worldScene = new ExtendedObject3D()
            worldScene.name = 'scene'
            worldScene.add(scene)
            this.add.existing(worldScene)

            // add animations
            // sadly only the flags animations works
            object.animations.forEach((anim, i) => {
                worldScene.mixer = this.animationMixers.create(worldScene)
                // overwrite the action to be an array of actions
                worldScene.action = []
                worldScene.action[i] = worldScene.mixer.clipAction(anim)
                worldScene.action[i].play()
            })

            worldScene.traverse(child => {
                if (child.isMesh) {
                    if (child.name === 'text-in') {
                        this.text.in = child;
                        return
                    }
                    if (child.name === 'text-out') {
                        this.text.out = child;
                        return
                    }
                    if (/event/i.test(child.name)) {
                        this.physics.add.existing(child, {
                            shape: 'concave',
                            mass: 0,
                            collisionFlags: 4,
                            autoCenter: false
                        })
                        console.log(child.body)
                        child.body.on.collision(data => {
                            if (this.man === data) {
                                this.event001 = true;
                            }
                        })
                        child.visible = false;
                        return
                    }
                    if (/mesh/i.test(child.name)) {
                        child.castShadow = child.receiveShadow = false
                        child.material.metalness = 0
                        child.material.roughness = 1
                        this.physics.add.existing(child, {
                            shape: 'concave',
                            mass: 0,
                            collisionFlags: 1,
                            autoCenter: false
                        })
                        child.body.setAngularFactor(0, 0, 0)
                        child.body.setLinearFactor(0, 0, 0)

                        this.meshArr.push(child);
                        return;
                    }
                    if (/obj/i.test(child.name)) {
                        this.physics.add.existing(child, {
                            shape: 'convex',
                        })
                        return;
                    }
                }
            })
        }


        const addMan = async () => {
            const object = await this.load.gltf('man')
            const man = object.scene.children[0];

            this.man = new ExtendedObject3D()
            this.man.name = 'man'
            this.man.rotateY(Math.PI + 0.1) // a hack
            this.man.add(man)
            this.man.rotation.set(0, Math.PI * 1.5, 0)
            this.man.position.set(0, 10, 0)
            // add shadow
            this.man.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = child.receiveShadow = false
                    // https://discourse.threejs.org/t/cant-export-material-from-blender-gltf/12258
                    child.material.roughness = 1
                    child.material.metalness = 0
                }
            })

            /**
             * Animations
             */
            // ad the box man's animation mixer to the animationMixers array (for auto updates)
            this.animationMixers.add(this.man.anims.mixer)

            object.animations.forEach(animation => {
                if (animation.name) {
                    this.man.anims.add(animation.name, animation)
                }
            })
            this.man.anims.play('idle')

            /**
             * Add the player to the scene with a body
             */
            this.add.existing(this.man)
            let t = this.physics.add.existing(this.man, {
                shape: 'capsule',
                radius: 0.25,
                width: 0.5,
                height: 0.4,
                offset: { y: -0.5 }
            })

            this.man.body.setFriction(0.8)
            this.man.body.setAngularFactor(0, 0, 0)

            // https://docs.panda3d.org/1.10/python/programming/physics/bullet/ccd
            this.man.body.setCcdMotionThreshold(1e-7)
            this.man.body.setCcdSweptSphereRadius(0.25)

            /**
             * Add 3rd Person Controls
             */
            this.controls = new ThirdPersonControls(this.camera, this.man, {
                offset: new THREE.Vector3(0, 1, 0),
                targetRadius: 3
            })
            // set initial view to 90 deg theta
            this.controls.theta = 90

            /**
             * Add Pointer Lock and Pointer Drag
             */
            if (!isTouchDevice) {
                // const that = this;
                // let islock = false;
                // window.addEventListener("click", async () => {
                //     try {
                //         document.body.requestPointerLock()
                //     } catch (error) {
                //         console.log('requestPointerLock fail')
                //     }
                // });
                // window.addEventListener('pointermove', function(e) {
                //     if(!islock) { return }

                //     that.moveTop = -e.movementY
                //     that.moveRight = e.movementX
                // })

                // document.addEventListener('pointerlockchange', (e) => {
                //     islock = document.body === document.pointerLockElement;
                // });
                let isPress = false;
                window.addEventListener('mousedown', e => {
                    isPress = true;
                })
                window.addEventListener('mouseup', e => {
                    isPress = false;
                })
                window.addEventListener('mouseleave', e => {
                    isPress = false;
                })

                window.addEventListener('mousemove', e => {
                    if(!isPress) { return }

                    this.moveTop = -e.movementY;
                    this.moveRight = -e.movementX;
                })
            }
        }

        const video = () => {
            const video = document.createElement('video');
            video.src = "./assets/video/test.mp4";
            video.currentTime = 1;

            video.setAttribute('controls', '');
            video.setAttribute('loop', '');
            const texture = new THREE.VideoTexture(video);

            window.addEventListener('click', () => {
                if(this.isVideoOver && video.paused) {
                    video.play();
                    return
                }
                if(this.isVideoOver && !video.paused) {
                    video.pause();
                    return
                }
            });


            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: texture });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.y = 1;
            cube.position.x = -4;

            this.physics.add.existing(cube, {
                shape: 'convex',
            })

            this.scene.add(cube);
            this.videoObjArr.push(cube)


        }

        const Raycaster = () => {
            const pointer = new THREE.Vector2();
            const raycaster = new THREE.Raycaster();

            const size = 0.2
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const cube = new THREE.Mesh(geometry, material);

            this.scene.add(cube);

            let point;

            const onMouseMove = (event) => {
                pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
                pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

                raycaster.setFromCamera(pointer, this.camera);
                const intersectsMesh = raycaster.intersectObjects(this.meshArr);
                if(intersectsMesh.length > 0) { 
                    cube.position.x = intersectsMesh[0].point.x
                    cube.position.y = intersectsMesh[0].point.y
                    cube.position.z = intersectsMesh[0].point.z

                    point = intersectsMesh[0].point;
                }

                const clickEvent = raycaster.intersectObjects(this.videoObjArr);
                this.isVideoOver = clickEvent.length > 0;
            };
            window.addEventListener('mousemove', onMouseMove);

            
            const onDown = (e) => {
                if(e.button !== 2) { return }

                if(this.moveToObj !== null) {
                    this.scene.remove(this.moveToObj)
                }
                this.isMove = true;
                this.man.anims.play('run')
                this.moveToPostion = {
                    x: point.x,
                    y: point.y,
                    z: point.z,
                }
                const size = 0.2
                const geometry = new THREE.BoxGeometry(size, size, size);
                const material = new THREE.MeshLambertMaterial({ color: 0xff8100 });
                const cube = new THREE.Mesh(geometry, material);
                cube.position.x = point.x
                cube.position.y = point.y
                cube.position.z = point.z

                this.scene.add(cube);
                this.moveToObj = cube;
            }
            
            window.addEventListener('mousedown', onDown);
            window.addEventListener('touchmove', (e) => {
                console.log(e)
                e.clientX = e.touches[0].x;
                e.clientY = e.touches[0].y;
                onMouseMove(e);
            });
        }


        addWorld().then(Raycaster)
        addMan();
        video();


        /**
         * Add Keys
         */
        this.keys = {
            w: { isDown: false },
            a: { isDown: false },
            s: { isDown: false },
            d: { isDown: false },
            v: { isDown: false },
            space: { isDown: false },
        }

        const press = (e, isDown) => {
            e.preventDefault()
            const { keyCode } = e
            switch (keyCode) {
                case 87: // w
                    this.keys.w.isDown = isDown
                    break
                case 38: // arrow up
                    this.keys.w.isDown = isDown
                    break
                case 32: // space
                    this.keys.space.isDown = isDown
                    break
                case 86: // space
                    this.keys.v.isDown = isDown
                    break
            }
        }

        document.addEventListener('keydown', e => press(e, true))
        document.addEventListener('keyup', e => press(e, false))

        /**
         * Add joystick
         */
        if (isTouchDevice) {
            const joystick = new JoyStick()
            const axis = joystick.add.axis({
                styles: { left: 20, bottom: 175, size: 100 }
            })
            axis.onMove(event => {
                /**
                 * Update Camera
                 */
                const { top, right } = event
                this.moveTop = top * 3
                this.moveRight = right * 3
            })
            const buttonA = joystick.add.button({
                letter: 'A',
                styles: { right: 20, bottom: 250, size: 80, fontSize: '50px' }
            })
            buttonA.onClick(() => this.jump())
            const buttonB = joystick.add.button({
                letter: 'B',
                styles: { right: 95, bottom: 175, size: 80, fontSize: '50px' }
            })
            console.log(buttonB)
            buttonB.onClick(() => (this.move = true))
            buttonB.onRelease(() => (this.move = false))
        }

    }

    jump() {
        if (!this.man || !this.canJump) return
        this.canJump = false
        this.man.anims.play('jump_running', 500, false)
        setTimeout(() => {
            this.canJump = true
            this.man.anims.play('idle', 500)
        }, 500)
        this.man.body.applyForceY(6)
    }

    radiusNormalize(v) {
        v = v % (Math.PI * 2);
        if(v < 0) {
            v = (Math.PI * 2) + v;
        }
        return v;
    }


    update(time, delta) {
        if (this.man && this.man.body) {

            this.controls.update(this.moveRight * 3, -this.moveTop * 3)
            if (!isTouchDevice) this.moveRight = this.moveTop = 0

            const speed = 4
            const v3 = new THREE.Vector3()

            const rotation = this.camera.getWorldDirection(v3)
            const theta = Math.atan2(rotation.x, rotation.z)
            const rotationMan = this.man.getWorldDirection(v3)
            const thetaMan = Math.atan2(rotationMan.x, rotationMan.z)
            this.man.body.setAngularVelocityY(0)

            // this.log.innerText = `speed: ${nowSpeed} \n` + 
            // 'last pos:' + JSON.stringify(this.lastPosition) + '\n' + 
            // 'now  pos:' + JSON.stringify(this.man.body.position)


            if(this.isMove) {
                const theta = this.radiusNormalize(
                    Math.atan2(
                        (this.moveToPostion.x - this.man.body.position.x),
                        (this.moveToPostion.z - this.man.body.position.z),
                    )
                )
                const thetaMan = this.radiusNormalize(this.man.body.rotation.y);
                
                const l = Math.abs(theta - thetaMan)
                let rotationSpeed = 4
                let d = Math.PI / 24
                
                if (l > d) {
                    if (l > Math.PI - d) rotationSpeed *= -1
                    if (theta < thetaMan) rotationSpeed *= -1
                    this.man.body.setAngularVelocityY(rotationSpeed)
                }
            }
            else {
                const l = Math.abs(theta - thetaMan)
                let rotationSpeed = isTouchDevice ? 2 : 4
                let d = Math.PI / 24
    
                if (l > d) {
                    if (l > Math.PI - d) rotationSpeed *= -1
                    if (theta < thetaMan) rotationSpeed *= -1
                    this.man.body.setAngularVelocityY(rotationSpeed)
                }
            }
            

            /**
             * Player Move
             */
            if (this.keys.w.isDown || this.move) { 
                if (this.man.anims.current === 'idle' && this.canJump) this.man.anims.play('run')

                const x = Math.sin(theta) * speed,
                    y = this.man.body.velocity.y,
                    z = Math.cos(theta) * speed

                this.man.body.setVelocity(x, y, z)
                this.isMove = false;
            } else {
                if (this.man.anims.current === 'run' && this.canJump && !this.isMove) this.man.anims.play('idle')
            }

            /**
             * Player Jump
             */
            if (this.keys.space.isDown && this.canJump) {
                this.jump()
            }

            if (this.event001 && !this.isevent001) {
                this.isevent001 = true
            }
            if (this.isevent001 && !this.event001) {
                this.isevent001 = false;
            }
            if (this.text.in && this.text.out) {
                this.text.in.visible = this.event001;
                this.text.out.visible = !this.event001;
            }

            this.event001 = false;

            if(this.isMove) {
                const theta = Math.atan2(
                    (this.moveToPostion.z - this.man.body.position.z),
                    (this.moveToPostion.x - this.man.body.position.x)
                )
                let disZ = this.moveToPostion.z - this.man.body.position.z;
                disZ *= disZ < 0 ? -1 : 1;

                let disX = this.moveToPostion.x - this.man.body.position.x;
                disX *= disX < 0 ? -1 : 1;

                if(
                    (disZ < 0.1) &&
                    (disX < 0.1)
                ) {
                    this.isMove = false;
                    this.man.body.setVelocity(0, 0, 0)
                    this.scene.remove(this.moveToObj);
                    return;
                }

                let x = Math.cos(theta) * 2;
                let y = this.man.body.velocity.y;
                let z = Math.sin(theta) * 2;

            
                this.man.body.setVelocity(x, y, z)
            }

            this.lastPosition.x = this.man.position.x;
            this.lastPosition.y = this.man.position.y;
            this.lastPosition.z = this.man.position.z;
        }
    }
}

window.addEventListener('load', () => {
    PhysicsLoader('./lib/ammo/moz', () => {
        const project = new Project({ antialias: true, maxSubSteps: 10, fixedTimeStep: 1 / 120, scenes: [MainScene] })

        const resize = () => {
            const newWidth = window.innerWidth
            const newHeight = window.innerHeight

            project.renderer.setSize(newWidth, newHeight)
            project.camera.aspect = newWidth / newHeight
            project.camera.updateProjectionMatrix()
        }

        window.onresize = resize
        resize()
    })
})

