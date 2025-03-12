// Global utility functions from video_capture.html
const log = window.log || console.log;
const handleError = window.handleError || ((error, context) => {
    console.error(`Error in ${context}:`, error);
});

// Constants
const FRAME_RATE = 60;
const ORBIT_SPEED = 30; // degrees per second
const VIDEO_DURATION = 4; // seconds (shortened from 12)
const TOTAL_FRAMES = FRAME_RATE * VIDEO_DURATION;

// Camera parameters - make globally accessible for UI controls
window.CAMERA_CONFIG = {
    fov: 75,
    near: 0.1,
    far: 1000,
    orbitRadius: 50,
    orbitHeight: 30,
    orbitSpeed: ORBIT_SPEED * (Math.PI / 180), // Convert to radians
    startAngle: 0
};

// Global state
let currentRealm = 'HUB';
let iframe = null;
let capturer = null;
let isCapturing = false;
let isPaused = false;
let currentFrame = 0;
let cameraAngle = 0;
window.frameCount = 0;

// Available HTML files for capture
const AVAILABLE_FILES = [
    { name: 'HUB', url: './index_hub.html', duration: 4 },
    { name: 'MYSTICAL', url: './mystical.html', duration: 4 },
    { name: 'NATURAL', url: './natural.html', duration: 4 },
    { name: 'TECHNOLOGICAL', url: './technological.html', duration: 4 },
    { name: 'ABSTRACT', url: './abstract.html', duration: 4 },
    { name: 'Q-LEARNING', url: './q-learning-grid-world.html', duration: 4 },
    { name: 'HYPERCUBE', url: './temporal-difference.html', duration: 4 },
    { name: 'EPISODES', url: './q-learning-episode-viewer.html', duration: 4 },
    { name: 'DYNAMIC CAMERA', url: './dynamic-camera.html', duration: 4 }
];

// Currently selected file - set to index_hub.html by default
let currentFileIndex = 0; // Default to index_hub.html

function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        log('WebGL supported');
        return true;
    } catch (error) {
        handleError(error, 'WebGL check');
        return false;
    }
}

function updateCameraInfo(cameraObj) {
    const cameraInfoEl = document.getElementById('camera-info');
    if (!cameraInfoEl) return;
    
    // Use provided camera object or try to get it from the realm window
    let camera = cameraObj;
    if (!camera) {
        const realmWindow = iframe?.contentWindow;
        const captureData = realmWindow?._captureData || {};
        camera = captureData.camera || realmWindow?.camera;
    }
    
    if (!camera || !camera.position) return;
    
    try {
        cameraInfoEl.innerHTML = `
            <div>Position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})</div>
            <div>Orbit Angle: ${(cameraAngle * 180 / Math.PI).toFixed(1)}°</div>
            <div>FOV: ${camera.fov ? camera.fov.toFixed(1) : 'N/A'}°</div>
        `;
    } catch (error) {
        // Silent fail for UI updates
        console.error('Error updating camera info:', error);
    }
}

function init() {
    try {
        if (!checkWebGLSupport()) return;
        log('Initializing video capture');
        
        // Create iframe for loading realm content
        iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        document.getElementById('capture-container').appendChild(iframe);
        
        // Initialize camera preview
        initCameraPreview();
        
        // Initialize CCapture with optimized settings
        capturer = new CCapture({
            format: 'webm',
            framerate: FRAME_RATE,
            verbose: true,
            display: true,
            quality: 85, // Slightly reduced quality for faster processing
            name: 'reality_media_short'
        });
        
        // Update UI to show video parameters
        document.getElementById('capture-status').textContent = `Ready to capture ${VIDEO_DURATION}s video at ${FRAME_RATE}fps`;
        
        // Connect UI controls
        connectUIControls();
        
        // Update sequence timeline
        updateSequenceTimeline();
        
        // Load the default file (index_hub.html)
        loadSelectedFile('index_hub.html');
        
        log(`Video capture system initialized (${VIDEO_DURATION}s duration)`, 'success');
    } catch (error) {
        handleError(error, 'initialization');
    }
}

function connectUIControls() {
    // Connect existing HTML buttons to functions
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');
    const loadFileBtn = document.getElementById('load-file-btn');
    const fileSelector = document.getElementById('html-file-selector');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startCapturing();
            startBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = false;
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            pauseCapture();
            pauseBtn.disabled = true;
            if (resumeBtn) resumeBtn.disabled = false;
        });
    }
    
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            resumeCapture();
            resumeBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = false;
        });
    }
    
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            restartCapture();
            if (startBtn) startBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
            if (resumeBtn) resumeBtn.disabled = true;
        });
    }
    
    // Add event listener for the file selector
    if (loadFileBtn && fileSelector) {
        loadFileBtn.addEventListener('click', () => {
            const selectedFile = fileSelector.value;
            loadSelectedFile(selectedFile);
        });
    }
}

function updateSequenceTimeline() {
    const timelineContainer = document.getElementById('sequence-timeline');
    if (!timelineContainer) return;
    
    // Clear existing timeline
    timelineContainer.innerHTML = '';
    
    // Create a step for each available file
    AVAILABLE_FILES.forEach((file, index) => {
        const step = document.createElement('div');
        step.className = 'sequence-step';
        step.setAttribute('data-name', file.name);
        step.setAttribute('data-index', index);
        
        // Add click handler to navigate to this realm
        step.addEventListener('click', () => {
            goToRealm(index);
        });
        
        timelineContainer.appendChild(step);
    });
    
    // Update active step
    updateActiveStep();
}

function pauseCapture() {
    if (!isCapturing || isPaused) return;
    
    log('Pausing capture', 'warning');
    isPaused = true;
    document.getElementById('capture-status').textContent = 'Capture paused';
}

function resumeCapture() {
    if (!isCapturing || !isPaused) return;
    
    log('Resuming capture', 'success');
    isPaused = false;
}

function goToNextRealm() {
    const nextIndex = (currentFileIndex + 1) % AVAILABLE_FILES.length;
    goToRealm(nextIndex);
}

function goToRealm(index) {
    if (index < 0 || index >= AVAILABLE_FILES.length) return;
    
    const file = AVAILABLE_FILES[index];
    loadSelectedFile(file.url.replace('./', ''));
}

function restartCapture() {
    try {
        // Stop current capture if running
        if (isCapturing) {
            isCapturing = false;
            if (capturer) {
                try {
                    capturer.stop();
                    capturer.save();
                } catch (e) {
                    console.error('Error stopping capturer:', e);
                }
            }
        }
        
        // Reset state
        currentFrame = 0;
        isPaused = false;
        
        // Reset progress UI
        const progressBar = document.getElementById('capture-progress');
        const statusText = document.getElementById('capture-status');
        
        if (progressBar) progressBar.style.width = '0%';
        if (statusText) statusText.textContent = `Ready to capture ${VIDEO_DURATION}s video at ${FRAME_RATE}fps`;
        
        // Re-enable start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) startBtn.disabled = false;
        
        log('Capture reset', 'info');
    } catch (error) {
        handleError(error, 'restart capture');
    }
}

function loadSelectedFile(fileName) {
    try {
        log(`Loading ${fileName}...`);
        
        // Find the file in our available files
        const fileObj = AVAILABLE_FILES.find(file => file.url === `./${fileName}`);
        if (!fileObj) {
            throw new Error(`File ${fileName} not found in available files`);
        }
        
        // Update current file index
        currentFileIndex = AVAILABLE_FILES.indexOf(fileObj);
        currentRealm = fileObj.name;
        
        // Update UI
        document.getElementById('current-scene').textContent = `Current: ${currentRealm}`;
        
        // Update file selector to match
        const fileSelector = document.getElementById('html-file-selector');
        if (fileSelector) {
            fileSelector.value = fileName;
        }
        
        // Reset capture state
        restartCapture();
        
        // Update active step in timeline
        updateActiveStep();
        
        // Load the file in the iframe
        if (iframe) {
            // Show loading message
            const previewCanvas = document.getElementById('preview-canvas');
            if (previewCanvas) {
                const ctx = previewCanvas.getContext('2d');
                ctx.fillStyle = '#222';
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Loading ${fileName}...`, previewCanvas.width/2, previewCanvas.height/2);
            }
            
            // Set iframe source
            iframe.src = fileName;
            
            // Wait for iframe to load
            iframe.onload = () => {
                log(`${fileName} loaded successfully`, 'success');
                
                try {
                    // Access the iframe's window
                    const realmWindow = iframe.contentWindow;
                    
                    // Inject a script to expose THREE.js objects to the global window scope
                    // This is especially important for module scripts like in index_hub.html
                    const script = document.createElement('script');
                    script.textContent = `
                        // Wait for scene initialization to complete
                        setTimeout(() => {
                            // Create VideoCaptureInterface to expose THREE.js objects
                            window.VideoCaptureInterface = window.VideoCaptureInterface || {};
                            
                            // For module scripts, try to access variables from the global scope
                            if (typeof renderer !== 'undefined') window.renderer = renderer;
                            if (typeof scene !== 'undefined') window.scene = scene;
                            if (typeof camera !== 'undefined') window.camera = camera;
                            
                            // Expose to VideoCaptureInterface as well
                            window.VideoCaptureInterface.renderer = window.renderer;
                            window.VideoCaptureInterface.scene = window.scene;
                            window.VideoCaptureInterface.camera = window.camera;
                            
                            // Notify parent that objects are ready
                            window.parent.postMessage('threejs_objects_ready', '*');
                            
                            console.log('THREE.js objects exposed to global scope:', {
                                renderer: !!window.renderer,
                                scene: !!window.scene,
                                camera: !!window.camera
                            });
                        }, 500); // Give time for the scene to initialize
                    `;
                    
                    // Inject the script into the iframe
                    realmWindow.document.body.appendChild(script);
                    
                    // Listen for the message from the iframe
                    window.addEventListener('message', function onMessage(event) {
                        if (event.data === 'threejs_objects_ready') {
                            // Remove the event listener to avoid duplicates
                            window.removeEventListener('message', onMessage);
                            
                            // Check if the realm has a VideoCaptureInterface now
                            if (realmWindow.VideoCaptureInterface) {
                                log('VideoCaptureInterface ready in realm', 'success');
                                
                                // Update camera preview with the exposed objects
                                updateCameraPreview(realmWindow);
                                
                                // Try to get camera info
                                const camera = realmWindow.camera || 
                                             (realmWindow.VideoCaptureInterface && realmWindow.VideoCaptureInterface.camera);
                                
                                if (camera) {
                                    updateCameraInfo(camera);
                                }
                            } else {
                                log('Could not create VideoCaptureInterface', 'warning');
                            }
                        }
                    });
                    
                    // Fallback: Check for THREE.js objects directly
                    // This is a backup in case the message event doesn't fire
                    setTimeout(() => {
                        // Look for renderer, scene, camera
                        const renderer = realmWindow.renderer;
                        const scene = realmWindow.scene;
                        const camera = realmWindow.camera;
                        
                        if (renderer && scene && camera) {
                            log('Found renderer, scene, and camera in realm', 'success');
                            
                            // Create minimal capture interface if not already created
                            if (!realmWindow.VideoCaptureInterface) {
                                realmWindow.VideoCaptureInterface = {
                                    renderer,
                                    scene,
                                    camera
                                };
                            }
                            
                            // Update camera preview
                            updateCameraPreview(realmWindow);
                            updateCameraInfo(camera);
                        } else {
                            log('Could not find renderer, scene, or camera in realm', 'warning');
                        }
                    }, 1000);
                    
                } catch (error) {
                    handleError(error, 'iframe access');
                }
            };
            
            // Handle iframe load errors
            iframe.onerror = (error) => {
                handleError(error, 'iframe loading');
            };
        }
    } catch (error) {
        handleError(error, 'load selected file');
    }
}

function startCapturing() {
    try {
        if (isCapturing) return;
        
        log('Starting capture...');
        
        // Reset frame counter
        currentFrame = 0;
        window.frameCount = 0;
        
        // Get the current file details
        const fileSelector = document.getElementById('html-file-selector');
        const fileName = fileSelector ? fileSelector.value : 'index_hub.html';
        const fileObj = AVAILABLE_FILES.find(file => file.url === `./${fileName}`);
        const fileDuration = fileObj ? fileObj.duration : 4;
        const totalFrames = Math.floor(fileDuration * FRAME_RATE);
        
        // Update UI
        document.getElementById('capture-status').textContent = `Starting capture (${totalFrames} frames)`;
        document.getElementById('capture-progress').style.width = '0%';
        
        // Get the realm window
        const realmWindow = iframe.contentWindow;
        if (!realmWindow) {
            throw new Error('Realm window not available');
        }
        
        // Check if we have access to the renderer
        let renderer, scene, camera;
        
        // Try to access the renderer, scene, and camera
        // First check VideoCaptureInterface (our new approach)
        if (realmWindow.VideoCaptureInterface && realmWindow.VideoCaptureInterface.renderer) {
            renderer = realmWindow.VideoCaptureInterface.renderer;
            scene = realmWindow.VideoCaptureInterface.scene;
            camera = realmWindow.VideoCaptureInterface.camera;
            log('Using VideoCaptureInterface for capture');
        }
        // Then check direct window properties (for objects we exposed to global scope)
        else if (realmWindow.renderer) {
            renderer = realmWindow.renderer;
            scene = realmWindow.scene;
            camera = realmWindow.camera;
            log('Using direct window properties for capture');
        }
        // Finally check _captureData (legacy approach)
        else if (realmWindow._captureData && realmWindow._captureData.renderer) {
            renderer = realmWindow._captureData.renderer;
            scene = realmWindow._captureData.scene;
            camera = realmWindow._captureData.camera;
            log('Using _captureData for capture');
        } else {
            throw new Error('No renderer found in realm');
        }
        
        if (!renderer || !renderer.domElement) {
            throw new Error('No valid renderer found');
        }
        
        // Start the capturer
        try {
            capturer.start();
            log('CCapture started', 'success');
        } catch (e) {
            handleError(e, 'CCapture start');
            return;
        }
        
        // Set capture state
        isCapturing = true;
        isPaused = false;
        
        // Enable UI controls
        document.getElementById('pause-btn').disabled = false;
        document.getElementById('restart-btn').disabled = false;
        
        // Start animation loop
        animate();
        
        log('Capture started', 'success');
    } catch (error) {
        handleError(error, 'start capturing');
    }
}

function animate() {
    try {
        if (!isCapturing) return;
        
        requestAnimationFrame(animate);
        
        // Skip frame if paused
        if (isPaused) return;
        
        // Get the current scene from iframe
        const realmWindow = iframe.contentWindow;
        if (!realmWindow) {
            log('Waiting for realm window...', 'warning');
            return;
        }
        
        // Get capture data (might be stored in different places)
        let renderer, scene, camera;
        
        // Try to access the renderer, scene, and camera
        // First check VideoCaptureInterface (our new approach)
        if (realmWindow.VideoCaptureInterface && realmWindow.VideoCaptureInterface.renderer) {
            renderer = realmWindow.VideoCaptureInterface.renderer;
            scene = realmWindow.VideoCaptureInterface.scene;
            camera = realmWindow.VideoCaptureInterface.camera;
        }
        // Then check direct window properties (for objects we exposed to global scope)
        else if (realmWindow.renderer) {
            renderer = realmWindow.renderer;
            scene = realmWindow.scene;
            camera = realmWindow.camera;
        }
        // Finally check _captureData (legacy approach)
        else if (realmWindow._captureData && realmWindow._captureData.renderer) {
            renderer = realmWindow._captureData.renderer;
            scene = realmWindow._captureData.scene;
            camera = realmWindow._captureData.camera;
        }
        
        // If we still don't have a renderer, try to find it in other places
        if (!renderer || !renderer.domElement) {
            // Try to find any canvas element as a last resort
            try {
                const canvas = iframe.contentDocument.querySelector('canvas');
                if (canvas) {
                    log('Found canvas but no renderer available', 'warning');
                    
                    // Try to inject a script to expose THREE.js objects again
                    const script = document.createElement('script');
                    script.textContent = `
                        // Try to expose THREE.js objects again
                        if (typeof renderer !== 'undefined') window.renderer = renderer;
                        if (typeof scene !== 'undefined') window.scene = scene;
                        if (typeof camera !== 'undefined') window.camera = camera;
                        
                        // Create VideoCaptureInterface
                        window.VideoCaptureInterface = window.VideoCaptureInterface || {};
                        window.VideoCaptureInterface.renderer = window.renderer;
                        window.VideoCaptureInterface.scene = window.scene;
                        window.VideoCaptureInterface.camera = window.camera;
                        
                        console.log('Attempted to re-expose THREE.js objects:', {
                            renderer: !!window.renderer,
                            scene: !!window.scene,
                            camera: !!window.camera
                        });
                    `;
                    realmWindow.document.body.appendChild(script);
                }
            } catch (e) {
                // Ignore errors from cross-origin frames
            }
            
            log('WARNING: Missing renderer, scene, or camera for rendering', 'warning');
            return;
        }
        
        try {
            // Update the camera info for display
            if (camera && camera.position) {
                updateCameraInfo(camera);
            }
            
            // Directly render with the renderer, scene, and camera
            if (renderer && scene && camera) {
                try {
                    // Check if the scene has an animate or render function
                    if (typeof realmWindow.animate === 'function') {
                        // Some scenes might have their own animation loop
                        // Just let it run naturally
                    } else if (typeof realmWindow.render === 'function') {
                        // Call the scene's render function if available
                        realmWindow.render();
                    } else {
                        // Manually render the scene
                        renderer.render(scene, camera);
                    }
                } catch (e) {
                    log('Error rendering: ' + e.message, 'error');
                }
            } else {
                log('WARNING: Missing renderer, scene, or camera for rendering', 'warning');
            }
            
            // Capture the current frame from the renderer
            try {
                capturer.capture(renderer.domElement);
            } catch (e) {
                log('Error capturing frame: ' + e.message, 'error');
            }
            
            // Update camera preview
            updateCameraPreview(realmWindow, renderer);
            
            // Update frame counters
            currentFrame++;
            window.frameCount++;
            
            // Get the current file details
            const fileSelector = document.getElementById('html-file-selector');
            const fileName = fileSelector ? fileSelector.value : 'index_hub.html';
            const fileObj = AVAILABLE_FILES.find(file => file.url === `./${fileName}`);
            const fileDuration = fileObj ? fileObj.duration : 4;
            const totalFrames = Math.floor(fileDuration * FRAME_RATE);
            
            // Check if we've completed the capture
            if (currentFrame >= totalFrames) {
                finishCapture();
                return;
            }
            
            // Update progress
            updateProgress();
            
        } catch (innerError) {
            handleError(innerError, 'frame processing');
        }
    } catch (error) {
        handleError(error, 'animation loop');
    }
}

function initCameraPreview() {
    const previewCanvas = document.getElementById('preview-canvas');
    if (!previewCanvas) return;
    
    // Set initial preview state
    const ctx = previewCanvas.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Camera preview will appear here', previewCanvas.width/2, previewCanvas.height/2);
}

function updateCameraPreview(realmWindow, rendererObj) {
    try {
        const previewCanvas = document.getElementById('preview-canvas');
        if (!previewCanvas) return;
        
        // Get renderer (try different sources)
        let renderer = rendererObj;
        
        // If no renderer was provided, try to get it from the realm window
        if (!renderer) {
            // First try VideoCaptureInterface
            if (realmWindow && realmWindow.VideoCaptureInterface && realmWindow.VideoCaptureInterface.renderer) {
                renderer = realmWindow.VideoCaptureInterface.renderer;
                log('Using renderer from VideoCaptureInterface', 'info');
            }
            // Then try direct window access (for objects we exposed to global scope)
            else if (realmWindow && realmWindow.renderer) {
                renderer = realmWindow.renderer;
                log('Using renderer from window.renderer', 'info');
            }
            // Finally try _captureData (legacy)
            else if (realmWindow && realmWindow._captureData && realmWindow._captureData.renderer) {
                renderer = realmWindow._captureData.renderer;
                log('Using renderer from _captureData', 'info');
            }
        }
        
        if (!renderer || !renderer.domElement) {
            // If we can't get the renderer, show a message in the preview
            const ctx = previewCanvas.getContext('2d');
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for scene to initialize...', previewCanvas.width/2, previewCanvas.height/2);
            return;
        }
        
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // Draw the current view from the renderer to the preview canvas
        try {
            ctx.drawImage(
                renderer.domElement,
                0, 0, renderer.domElement.width, renderer.domElement.height,
                0, 0, previewCanvas.width, previewCanvas.height
            );
            
            // If we successfully drew the preview, log success
            log('Camera preview updated successfully', 'info');
        } catch (e) {
            console.error('Error drawing preview:', e);
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.fillStyle = '#f44336';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error drawing preview: ' + e.message, previewCanvas.width/2, previewCanvas.height/2);
            return;
        }
        
        // Add camera position indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, previewCanvas.height - 40, previewCanvas.width, 40);
        
        // Get camera data from the scene (try different sources)
        const camera = 
            (realmWindow && realmWindow.VideoCaptureInterface && realmWindow.VideoCaptureInterface.camera) ||
            (realmWindow && realmWindow.camera) || 
            (realmWindow && realmWindow._captureData && realmWindow._captureData.camera);
        
        // Get the current file details
        const fileSelector = document.getElementById('html-file-selector');
        const fileName = fileSelector ? fileSelector.value : 'index_hub.html';
        const fileObj = AVAILABLE_FILES.find(file => file.url === `./${fileName}`);
        const fileDuration = fileObj ? fileObj.duration : 4;
        const totalFrames = Math.floor(fileDuration * FRAME_RATE);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px Arial';
        
        // Display camera position if available
        if (camera && camera.position) {
            const pos = camera.position;
            ctx.fillText(`Pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`, 5, previewCanvas.height - 25);
        }
        
        ctx.fillText(`Frame: ${currentFrame}/${totalFrames}`, 5, previewCanvas.height - 10);
        
        // Display current file name
        ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
        ctx.fillText(`File: ${fileName.replace('.html', '')}`, previewCanvas.width - 70, previewCanvas.height - 10);
    } catch (error) {
        // Log preview errors
        console.error('Preview error:', error);
        log('Error updating camera preview: ' + error.message, 'error');
    }
}

function updateActiveStep() {
    const steps = document.querySelectorAll('.sequence-step');
    steps.forEach((step, index) => {
        if (index === currentFileIndex) {
            step.classList.add('active');
        } else if (index < currentFileIndex) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

function finishCapture() {
    try {
        if (!isCapturing) return;
        
        log('Finishing capture...', 'info');
        
        // Stop the capturer
        isCapturing = false;
        isPaused = false;
        
        // Update UI
        document.getElementById('capture-status').textContent = 'Processing video...';
        document.getElementById('capture-progress').style.width = '100%';
        
        // Disable UI controls
        document.getElementById('pause-btn').disabled = true;
        document.getElementById('resume-btn').disabled = true;
        
        // Stop and save the capturer
        capturer.stop();
        capturer.save();
        
        log('Capture finished! Video is being processed and will download automatically.', 'success');
        
        // Re-enable start button
        document.getElementById('start-btn').disabled = false;
    } catch (error) {
        handleError(error, 'finish capture');
    }
}

function updateProgress() {
    try {
        // Get the current file details
        const fileSelector = document.getElementById('html-file-selector');
        const fileName = fileSelector ? fileSelector.value : 'index_hub.html';
        const fileObj = AVAILABLE_FILES.find(file => file.url === `./${fileName}`);
        const fileDuration = fileObj ? fileObj.duration : 4;
        const totalFrames = Math.floor(fileDuration * FRAME_RATE);
        
        const progressBar = document.getElementById('capture-progress');
        const statusText = document.getElementById('capture-status');
        const realmDetails = document.getElementById('realm-details');
        
        if (progressBar && statusText) {
            const progress = (currentFrame / totalFrames) * 100;
            progressBar.style.width = `${Math.min(100, progress)}%`;
            statusText.textContent = `Capturing frame ${currentFrame}/${totalFrames} (${Math.round(progress)}%)`;
        }
        
        if (realmDetails) {
            realmDetails.innerHTML = `
                Duration: ${fileDuration}s<br>
                Frame: ${currentFrame} / ${totalFrames}
            `;
        }
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    log('Video capture app loaded');
    init();
});

// Export functions for debugging
window.videoCapture = {
    init,
    startCapturing,
    pauseCapture,
    resumeCapture,
    restartCapture,
    loadSelectedFile
};
