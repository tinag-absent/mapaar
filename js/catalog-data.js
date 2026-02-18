// Catalog Data - JSON Loader
(function() {
  // Initialize CatalogData object
  window.CatalogData = {
    modules: [],
    entities: [],
    locations: [],
    isLoaded: false,
    loadPromise: null
  };

  // Load data from JSON file
  async function loadCatalogData() {
    try {
      const response = await fetch('./data/catalog-data.json');
      if (!response.ok) {
        throw new Error(`Failed to load catalog data: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update CatalogData with loaded data
      window.CatalogData.modules = data.modules || [];
      window.CatalogData.entities = data.entities || [];
      window.CatalogData.locations = data.locations || [];
      window.CatalogData.isLoaded = true;
      
      console.log('Catalog data loaded successfully:', {
        modules: window.CatalogData.modules.length,
        entities: window.CatalogData.entities.length,
        locations: window.CatalogData.locations.length
      });
      
      // Dispatch custom event to notify that data is loaded
      window.dispatchEvent(new CustomEvent('catalogDataLoaded'));
      
      return window.CatalogData;
    } catch (error) {
      console.error('Error loading catalog data:', error);
      throw error;
    }
  }

  // Create a promise that resolves when data is loaded
  window.CatalogData.loadPromise = loadCatalogData();

  // Helper function for other scripts to wait for data
  window.CatalogData.whenReady = function() {
    return window.CatalogData.loadPromise;
  };
})();
