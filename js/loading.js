// Loading Animation System
(function() {
  'use strict';

  const LoadingSystem = {
    overlay: null,
    progressBar: null,
    statusText: null,
    stagesContainer: null,
    currentProgress: 0,
    stages: [
      { id: 'init', label: 'システム初期化中...' },
      { id: 'data', label: 'データ読み込み中...' },
      { id: 'assets', label: 'リソース準備中...' },
      { id: 'render', label: '画面構築中...' }
    ],

    // Initialize loading system
    init() {
      this.createLoadingHTML();
      this.overlay = document.getElementById('loadingOverlay');
      this.progressBar = document.querySelector('.loading-progress-bar');
      this.statusText = document.querySelector('.loading-status');
      this.stagesContainer = document.querySelector('.loading-stages');
      
      // Show loading overlay
      this.show();
      
      // Start the loading sequence
      this.startLoadingSequence();
    },

    // Create loading HTML
    createLoadingHTML() {
      const loadingHTML = `
        <div class="loading-overlay" id="loadingOverlay">
          <div class="loading-grid"></div>
          <div class="loading-scanline"></div>
          
          <div class="loading-content">
            <div class="loading-spinner">
              <div class="hexagon hexagon-outer"></div>
              <div class="hexagon hexagon-middle"></div>
              <div class="hexagon hexagon-inner"></div>
            </div>
            
            <div class="loading-text">LOADING</div>
            
            <div class="loading-progress">
              <div class="loading-progress-bar"></div>
            </div>
            
            <div class="loading-status">初期化中...</div>
            
            <div class="loading-stages">
              ${this.stages.map((stage, index) => `
                <div class="loading-stage" data-stage="${stage.id}">
                  <div class="loading-stage-icon pending"></div>
                  <span>${stage.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      // Insert at the beginning of body
      document.body.insertAdjacentHTML('afterbegin', loadingHTML);
    },

    // Show loading overlay
    show() {
      if (this.overlay) {
        this.overlay.classList.remove('hidden');
      }
    },

    // Hide loading overlay
    hide() {
      if (this.overlay) {
        this.overlay.classList.add('hidden');
        
        // Remove from DOM after transition
        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
          }
        }, 500);
      }
    },

    // Update progress bar
    updateProgress(percent, status) {
      this.currentProgress = Math.min(100, Math.max(0, percent));
      
      if (this.progressBar) {
        this.progressBar.style.width = this.currentProgress + '%';
      }
      
      if (status && this.statusText) {
        this.statusText.textContent = status;
      }

      // Add glitch effect randomly
      if (Math.random() > 0.7) {
        this.addGlitchEffect();
      }
    },

    // Update stage status
    updateStage(stageId, status) {
      const stageElement = document.querySelector(`[data-stage="${stageId}"]`);
      if (!stageElement) return;

      const icon = stageElement.querySelector('.loading-stage-icon');
      
      // Remove all status classes
      stageElement.classList.remove('active', 'complete');
      icon.classList.remove('pending', 'active', 'complete');
      icon.innerHTML = '';

      if (status === 'active') {
        stageElement.classList.add('active');
        icon.classList.add('active');
      } else if (status === 'complete') {
        stageElement.classList.add('complete');
        icon.classList.add('complete');
        icon.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        `;
      } else {
        icon.classList.add('pending');
      }
    },

    // Add glitch effect
    addGlitchEffect() {
      const textElement = document.querySelector('.loading-text');
      if (textElement) {
        textElement.classList.add('glitch');
        setTimeout(() => {
          textElement.classList.remove('glitch');
        }, 300);
      }
    },

    // Start loading sequence
    async startLoadingSequence() {
      try {
        // Stage 1: Initialize
        this.updateStage('init', 'active');
        this.updateProgress(10, 'システム初期化中...');
        await this.delay(300);
        this.updateStage('init', 'complete');

        // Stage 2: Load data
        this.updateStage('data', 'active');
        this.updateProgress(30, 'データ読み込み中...');
        
        // Wait for catalog data if it exists
        if (window.CatalogData && window.CatalogData.whenReady) {
          await window.CatalogData.whenReady();
          this.updateProgress(50, 'カタログデータ読み込み完了');
        } else {
          await this.delay(500);
        }
        
        this.updateStage('data', 'complete');

        // Stage 3: Load assets
        this.updateStage('assets', 'active');
        this.updateProgress(70, 'リソース準備中...');
        await this.waitForAssets();
        this.updateStage('assets', 'complete');

        // Stage 4: Render
        this.updateStage('render', 'active');
        this.updateProgress(90, '画面構築中...');
        await this.delay(300);
        this.updateStage('render', 'complete');

        // Complete
        this.updateProgress(100, 'ロード完了');
        await this.delay(500);

        // Hide loading screen
        this.hide();

      } catch (error) {
        console.error('Loading error:', error);
        this.updateProgress(100, 'エラーが発生しました');
        await this.delay(1000);
        this.hide();
      }
    },

    // Wait for DOM and assets to load
    waitForAssets() {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
          // Timeout fallback
          setTimeout(resolve, 2000);
        }
      });
    },

    // Delay helper
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };

  // Make it globally accessible
  window.LoadingSystem = LoadingSystem;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      LoadingSystem.init();
    });
  } else {
    LoadingSystem.init();
  }

})();
