/**
 * Video Capture Interface
 * 
 * This script provides a standardized interface for the video capture system
 * to interact with different scenes. Include this script in all HTML files
 * that need to be captured.
 * 
 * This works with all visualizations including:
 * - temporal-difference.html
 * - q-learning-grid-world.html
 * - q-learning-episode-viewer.html
 * - emergent-learning-dynamics.html
 * - mystical.html
 * - dynamic-camera.html
 */

// Create a global namespace for video capture
window.VideoCaptureInterface = {
    // Properties to be set by each scene
    renderer: null,
    scene: null,
    camera: null,
    
    // Initialize the interface with the scene's components
    init: function(renderer, scene, camera, animate, render) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Create a direct render method that always works
        this.directRender = function() {
            if (this.renderer && this.scene && this.camera) {
                console.log('VideoCaptureInterface: Direct rendering with camera');
                this.renderer.render(this.scene, this.camera);
                return true;
            }
            return false;
        };
        
        // Add a special method for capturing the current view
        this.captureCurrentView = function() {
            return this.directRender();
        };
        
        // Expose to window for backward compatibility - this is the most reliable method
        // for the video capture system to access these objects
        window._captureData = {
            renderer: renderer,
            scene: scene,
            camera: camera
        };
        
        // Also expose directly on window for easier access
        window.renderer = renderer;
        window.scene = scene;
        window.camera = camera;
        
        // Signal to parent that the scene is ready
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
                type: 'SCENE_READY',
                hasRenderer: !!renderer,
                hasScene: !!scene,
                hasCamera: !!camera
            }, '*');
        }
        
        console.log('Video Capture Interface initialized');
        return this;
    }
};
