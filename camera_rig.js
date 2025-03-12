/**
 * Advanced Camera Rig System
 * Designed for reinforcement learning visualizations with audio controls
 */
class CameraRig {
    constructor(camera, options = {}) {
        this.camera = camera;
        
        // Configuration
        this.config = {
            orbitSpeed: options.orbitSpeed || 0.2,
            orbitRadius: options.orbitRadius || 10,
            minRadius: options.minRadius || 3,
            maxRadius: options.maxRadius || 20,
            minHeight: options.minHeight || -5,
            maxHeight: options.maxHeight || 10,
            smoothing: options.smoothing || 0.1,
            target: options.target || new THREE.Vector3(0, 0, 0)
        };
        
        // State
        this.state = {
            currentRadius: this.config.orbitRadius,
            currentHeight: 0,
            currentAngle: 0,
            targetRadius: this.config.orbitRadius,
            targetHeight: 0,
            targetAngle: 0,
            audioEnabled: false,
            audioContext: null,
            audioAnalyser: null
        };
        
        // Initialize audio system
        this.initAudio();
    }
    
    initAudio() {
        if (typeof AudioContext !== 'undefined') {
            this.state.audioContext = new AudioContext();
            this.state.audioAnalyser = this.state.audioContext.createAnalyser();
            this.state.audioAnalyser.fftSize = 2048; // High resolution for voice
            this.audioData = new Uint8Array(this.state.audioAnalyser.frequencyBinCount);
            
            navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            })
            .then(stream => {
                const source = this.state.audioContext.createMediaStreamSource(stream);
                source.connect(this.state.audioAnalyser);
                this.state.audioEnabled = true;
                
                // Add compressor for better voice control
                const compressor = this.state.audioContext.createDynamicsCompressor();
                compressor.threshold.value = -50;
                compressor.knee.value = 40;
                compressor.ratio.value = 12;
                compressor.attack.value = 0;
                compressor.release.value = 0.25;
                
                source.connect(compressor);
                compressor.connect(this.state.audioAnalyser);
            })
            .catch(err => console.warn('Audio input not available:', err));
        }
    }
    
    getAudioLevel(frequency) {
        if (!this.state.audioEnabled) return 0;
        
        this.state.audioAnalyser.getByteFrequencyData(this.audioData);
        const index = Math.floor(frequency * this.audioData.length / this.state.audioContext.sampleRate);
        return this.audioData[index] / 255.0;
    }
    
    update(deltaTime) {
        if (this.state.audioEnabled) {
            // Get audio levels from different ranges
            const bassLevel = this.getAudioLevel(100);  // Orbit speed
            const midLevel = this.getAudioLevel(500);   // Height
            const highLevel = this.getAudioLevel(2000); // Zoom
            
            // Update targets based on audio
            this.state.targetAngle += deltaTime * this.config.orbitSpeed * (1 + bassLevel * 2);
            this.state.targetHeight = (midLevel - 0.5) * 10;
            this.state.targetRadius = THREE.MathUtils.lerp(
                this.config.minRadius,
                this.config.maxRadius,
                1 - highLevel
            );
        } else {
            // Default smooth orbit
            this.state.targetAngle += deltaTime * this.config.orbitSpeed;
        }
        
        // Smooth all movements
        this.state.currentAngle = THREE.MathUtils.lerp(
            this.state.currentAngle,
            this.state.targetAngle,
            this.config.smoothing
        );
        
        this.state.currentHeight = THREE.MathUtils.lerp(
            this.state.currentHeight,
            THREE.MathUtils.clamp(this.state.targetHeight, this.config.minHeight, this.config.maxHeight),
            this.config.smoothing
        );
        
        this.state.currentRadius = THREE.MathUtils.lerp(
            this.state.currentRadius,
            this.state.targetRadius,
            this.config.smoothing
        );
        
        // Update camera position
        this.camera.position.x = Math.sin(this.state.currentAngle) * this.state.currentRadius;
        this.camera.position.z = Math.cos(this.state.currentAngle) * this.state.currentRadius;
        this.camera.position.y = this.state.currentHeight;
        
        // Look at target
        this.camera.lookAt(this.config.target);
    }
    
    setTarget(target) {
        this.config.target.copy(target);
    }
    
    setOrbitSpeed(speed) {
        this.config.orbitSpeed = speed;
    }
    
    setRadius(radius) {
        this.state.targetRadius = THREE.MathUtils.clamp(
            radius,
            this.config.minRadius,
            this.config.maxRadius
        );
    }
}
