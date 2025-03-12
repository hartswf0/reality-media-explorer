/**
 * Video Capture Manager
 * Handles synchronized capture across all visualization types
 */

const VideoCaptureManager = {
    // Core components
    renderer: null,
    scene: null,
    camera: null,
    capturer: null,
    
    // Capture state
    isCapturing: false,
    frameCount: 0,
    targetFrameRate: 60,
    frameDuration: 1000 / 60, // ms between frames
    lastFrameTime: 0,
    
    // Scene-specific state
    sceneType: null, // 'rl', 'dynamic', 'abstract'
    sceneState: {
        rl: {
            gridSize: 5,
            episodeIndex: 0,
            stepIndex: 0
        },
        dynamic: {
            orbitAngle: 0,
            orbitSpeed: Math.PI / 180 * 30 // 30 degrees per second
        }
    },

    /**
     * Initialize the capture manager
     */
    init: function(config) {
        const { renderer, scene, camera, frameRate = 60 } = config;
        
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.targetFrameRate = frameRate;
        this.frameDuration = 1000 / frameRate;
        
        // Detect scene type based on content
        this.detectSceneType();
        
        // Initialize CCapture with optimal settings
        this.capturer = new CCapture({
            format: 'webm',
            framerate: frameRate,
            verbose: true,
            display: true,
            quality: 85,
            name: 'reality_media'
        });
        
        // Bind methods
        this.captureFrame = this.captureFrame.bind(this);
        this.animate = this.animate.bind(this);
        
        return this;
    },
    
    /**
     * Detect the type of scene we're capturing
     */
    detectSceneType: function() {
        // Check for RL visualization markers
        const hasGrid = this.scene.getObjectByName('grid-world');
        const hasHypercube = this.scene.getObjectByName('q-learning-cube');
        const hasEpisodeViewer = this.scene.getObjectByName('episode-container');
        
        if (hasGrid || hasHypercube || hasEpisodeViewer) {
            this.sceneType = 'rl';
            console.log('Detected RL visualization');
            return;
        }
        
        // Check for dynamic camera scene
        const hasDynamicCamera = this.camera.userData.isDynamic;
        if (hasDynamicCamera) {
            this.sceneType = 'dynamic';
            console.log('Detected dynamic camera scene');
            return;
        }
        
        // Default to abstract
        this.sceneType = 'abstract';
        console.log('Detected abstract scene');
    },
    
    /**
     * Start the capture process
     */
    startCapture: function() {
        // Validate system before starting
        const validation = VideoCaptureValidator.validateAll({
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            previewCanvas: document.getElementById('preview-canvas'),
            capturer: this.capturer,
            frameRate: this.targetFrameRate
        });
        
        if (!validation.valid) {
            console.error('Validation failed:', validation.diagnostics);
            return false;
        }
        
        this.isCapturing = true;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.capturer.start();
        
        // Start animation loop
        this.animate();
        
        return true;
    },
    
    /**
     * Capture a single frame
     */
    captureFrame: function() {
        // Update scene based on type
        switch (this.sceneType) {
            case 'rl':
                this.updateRLScene();
                break;
            case 'dynamic':
                this.updateDynamicScene();
                break;
            case 'abstract':
                this.updateAbstractScene();
                break;
        }
        
        // Force camera update
        if (this.camera.updateProjectionMatrix) {
            this.camera.updateProjectionMatrix();
        }
        
        // Render and capture
        this.renderer.render(this.scene, this.camera);
        this.capturer.capture(this.renderer.domElement);
        
        // Update frame count
        this.frameCount++;
    },
    
    /**
     * Update RL visualization scene
     */
    updateRLScene: function() {
        const state = this.sceneState.rl;
        
        // Handle different RL visualization types
        switch (window.location.pathname.split('/').pop()) {
            case 'temporal-difference.html':
                this.updateHypercubeVisualization();
                break;
            case 'q-learning-grid-world.html':
                this.updateGridWorldVisualization();
                break;
            case 'q-learning-episode-viewer.html':
                this.updateEpisodeViewer();
                break;
        }
    },
    
    /**
     * Update dynamic camera scene
     */
    updateDynamicScene: function() {
        const state = this.sceneState.dynamic;
        
        // Update orbit position
        state.orbitAngle += state.orbitSpeed * (this.frameDuration / 1000);
        
        // Update camera position
        this.camera.position.x = Math.cos(state.orbitAngle) * 50;
        this.camera.position.z = Math.sin(state.orbitAngle) * 50;
        this.camera.lookAt(this.scene.position);
    },
    
    /**
     * Update abstract scene
     */
    updateAbstractScene: function() {
        // Let the scene's own animation handle updates
        if (window.animate) {
            window.animate();
        }
    },
    
    /**
     * Main animation loop
     */
    animate: function() {
        if (!this.isCapturing) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        
        // Check if it's time for next frame
        if (deltaTime >= this.frameDuration) {
            this.captureFrame();
            this.lastFrameTime = currentTime;
            
            // Update preview if available
            if (window.updateCameraPreview) {
                window.updateCameraPreview(window, this.renderer);
            }
        }
        
        // Request next frame
        requestAnimationFrame(this.animate);
    },
    
    /**
     * Stop capture and save video
     */
    stopCapture: function() {
        if (!this.isCapturing) return;
        
        this.isCapturing = false;
        this.capturer.stop();
        this.capturer.save();
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoCaptureManager;
}
