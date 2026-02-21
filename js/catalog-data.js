// Catalog Data - JSON Loader (分割ファイル対応)
(function() {
  window.CatalogData = {
    modules: [],
    entities: [],
    locations: [],
    divisions: [],
    isLoaded: false,
    loadPromise: null,

    whenReady() {
      return this.loadPromise;
    }
  };

  async function loadCatalogData() {
    try {
      const [modulesRes, entitiesRes, locationsRes, divisionsRes] = await Promise.all([
        fetch('./data/modules-data.json'),
        fetch('./data/entities-data.json'),
        fetch('./data/locations-data.json'),
        fetch('./data/divisions-data.json')
      ]);

      const [modulesData, entitiesData, locationsData, divisionsData] = await Promise.all([
        modulesRes.json(),
        entitiesRes.json(),
        locationsRes.json(),
        divisionsRes.json()
      ]);

      window.CatalogData.modules   = modulesData.modules     || [];
      window.CatalogData.entities  = entitiesData.entities   || [];
      window.CatalogData.locations = locationsData.locations  || [];
      window.CatalogData.divisions = divisionsData.divisions  || [];
      window.CatalogData.isLoaded  = true;

      console.log('Catalog data loaded successfully:', {
        modules:   window.CatalogData.modules.length,
        entities:  window.CatalogData.entities.length,
        locations: window.CatalogData.locations.length,
        divisions: window.CatalogData.divisions.length
      });

      window.dispatchEvent(new CustomEvent('catalogDataLoaded'));
      return window.CatalogData;
    } catch (error) {
      console.error('Error loading catalog data:', error);
      throw error;
    }
  }

  window.CatalogData.loadPromise = loadCatalogData();
})();
