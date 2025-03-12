/**
 * Universal Scene Template for Video Capture
 * 
 * This template provides a standardized way to structure Three.js scenes
 * to ensure they work properly with the video capture system.
 * 
 * Usage:
 * 1. Import this file in your HTML scene
 * 2. Call UniversalSceneTemplate.init() with your scene components
 * 3. Use UniversalSceneTemplate.animate() as your animation loop
 */

const UniversalSceneTemplate = {
    // Core components
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    
    // Animation callback
    customAnimationCallback: null,
    
    // Initialization status
    initialized: false,
    
    /**
     * Initialize the universal scene template with your Three.js components
     * 
     * @param {Object} config Configuration object
     * @param {THREE.WebGLRenderer} config.renderer The Three.js renderer
     * @param {THREE.Scene} config.scene The Three.js scene
     * @param {THREE.Camera} config.camera The Three.js camera
     * @param {Object} config.controls Optional controls (OrbitControls, etc.)
     * @param {Function} config.animationCallback Custom animation function
     */
    init: function(config) {
        this.renderer = config.renderer;
        this.scene = config.scene;
        this.camera = config.camera;
        this.controls = config.controls || null;
        this.customAnimationCallback = config.animationCallback || null;
        
        // Expose components for video capture
        window.renderer = this.renderer;
        window.scene = this.scene;
        window.camera = this.camera;
        
        // Also expose via _captureData for compatibility
        window._captureData = {
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera
        };
        
        // Create captureCurrentView function
        window.captureCurrentView = this.captureCurrentView.bind(this);
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Signal to parent that the scene is ready
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'SCENE_READY' }, '*');
        }
        
        this.initialized = true;
        console.log('Universal Scene Template initialized');
        
        return this;
    },
    
    /**
     * Standard animation loop function
     * Call this instead of creating your own animation loop
     */
    animate: function() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Update controls if they exist
        if (this.controls && typeof this.controls.update === 'function') {
            this.controls.update();
        }
        
        // Call custom animation callback if provided
        if (this.customAnimationCallback) {
            this.customAnimationCallback();
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    },
    
    /**
     * Handle window resize
     */
    onWindowResize: function() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },
    
    /**
     * Capture the current view
     * This function is called by the video capture system
     * 
     * @returns {Boolean} True if capture was successful
     */
    captureCurrentView: function() {
        if (!this.initialized) {
            console.error('Universal Scene Template not initialized');
            return false;
        }
        
        // Update controls if they exist
        if (this.controls && typeof this.controls.update === 'function') {
            this.controls.update();
        }
        
        // Force a render with current camera and scene
        this.renderer.render(this.scene, this.camera);
        
        return true;
    }
};
