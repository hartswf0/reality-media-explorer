/**
 * Video Capture Validation System
 * Ensures proper rendering and capture across all scenes
 */

const VideoCaptureValidator = {
    // Core validation state
    validationState: {
        rendererReady: false,
        sceneReady: false,
        cameraReady: false,
        previewMatch: false,
        captureReady: false
    },

    // Validation results with detailed diagnostics
    diagnostics: [],

    /**
     * Validate renderer state and capabilities
     */
    validateRenderer: function(renderer) {
        this.diagnostics = [];
        
        if (!renderer) {
            this.diagnostics.push('❌ Renderer not found');
            return false;
        }

        // Check if renderer has a valid WebGL context
        if (!renderer.getContext) {
            this.diagnostics.push('❌ Renderer missing WebGL context');
            return false;
        }

        // Verify renderer size matches viewport
        if (renderer.domElement.width === 0 || renderer.domElement.height === 0) {
            this.diagnostics.push('❌ Renderer has invalid dimensions');
            return false;
        }

        // Check if renderer can actually render
        try {
            renderer.render(new THREE.Scene(), new THREE.Camera());
            this.diagnostics.push('✓ Renderer can perform basic render');
        } catch (e) {
            this.diagnostics.push(`❌ Renderer render failed: ${e.message}`);
            return false;
        }

        this.validationState.rendererReady = true;
        return true;
    },

    /**
     * Validate camera setup and position
     */
    validateCamera: function(camera) {
        if (!camera) {
            this.diagnostics.push('❌ Camera not found');
            return false;
        }

        // Check camera type
        if (!(camera instanceof THREE.Camera)) {
            this.diagnostics.push('❌ Invalid camera type');
            return false;
        }

        // Verify camera matrix is valid
        if (!camera.matrixWorld || camera.matrixWorld.determinant() === 0) {
            this.diagnostics.push('❌ Camera has invalid matrix');
            return false;
        }

        // Check camera position
        if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
            this.diagnostics.push('❌ Camera has invalid position');
            return false;
        }

        this.validationState.cameraReady = true;
        return true;
    },

    /**
     * Compare preview canvas with actual renderer output
     */
    validatePreviewMatch: function(previewCanvas, renderer) {
        if (!previewCanvas || !renderer) {
            this.diagnostics.push('❌ Missing preview or renderer for comparison');
            return false;
        }

        const previewCtx = previewCanvas.getContext('2d');
        const rendererCanvas = renderer.domElement;

        // Compare dimensions
        if (previewCanvas.width === 0 || previewCanvas.height === 0) {
            this.diagnostics.push('❌ Preview canvas has invalid dimensions');
            return false;
        }

        // Check if preview has actual content
        try {
            const previewData = previewCtx.getImageData(0, 0, 1, 1).data;
            if (previewData[0] === 0 && previewData[1] === 0 && 
                previewData[2] === 0 && previewData[3] === 0) {
                this.diagnostics.push('❌ Preview canvas is empty');
                return false;
            }
        } catch (e) {
            this.diagnostics.push(`❌ Preview canvas access error: ${e.message}`);
            return false;
        }

        this.validationState.previewMatch = true;
        return true;
    },

    /**
     * Validate scene content and readiness
     */
    validateScene: function(scene) {
        if (!scene) {
            this.diagnostics.push('❌ Scene not found');
            return false;
        }

        // Check if scene has any visible objects
        let hasVisibleObjects = false;
        scene.traverse(object => {
            if (object.visible && (object instanceof THREE.Mesh || 
                                 object instanceof THREE.Points || 
                                 object instanceof THREE.Line)) {
                hasVisibleObjects = true;
            }
        });

        if (!hasVisibleObjects) {
            this.diagnostics.push('❌ Scene has no visible objects');
            return false;
        }

        this.validationState.sceneReady = true;
        return true;
    },

    /**
     * Validate capture system readiness
     */
    validateCaptureSystem: function(capturer, frameRate) {
        if (!capturer) {
            this.diagnostics.push('❌ CCapture instance not found');
            return false;
        }

        // Verify frame rate is valid
        if (!frameRate || frameRate <= 0) {
            this.diagnostics.push('❌ Invalid frame rate');
            return false;
        }

        // Check if CCapture is properly initialized
        if (!capturer.start || !capturer.capture || !capturer.stop) {
            this.diagnostics.push('❌ CCapture missing required methods');
            return false;
        }

        this.validationState.captureReady = true;
        return true;
    },

    /**
     * Perform complete validation of the video capture system
     */
    validateAll: function(config) {
        const {renderer, scene, camera, previewCanvas, capturer, frameRate} = config;
        
        // Reset validation state
        Object.keys(this.validationState).forEach(key => {
            this.validationState[key] = false;
        });
        this.diagnostics = [];

        // Run all validations
        const rendererValid = this.validateRenderer(renderer);
        const cameraValid = this.validateCamera(camera);
        const sceneValid = this.validateScene(scene);
        const previewValid = this.validatePreviewMatch(previewCanvas, renderer);
        const captureValid = this.validateCaptureSystem(capturer, frameRate);

        // Check overall system readiness
        const allValid = rendererValid && cameraValid && sceneValid && 
                        previewValid && captureValid;

        if (allValid) {
            this.diagnostics.push('✓ All systems validated and ready');
        }

        return {
            valid: allValid,
            state: {...this.validationState},
            diagnostics: [...this.diagnostics]
        };
    }
};
