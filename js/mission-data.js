// Mission Database - JSON Loader
(function() {
  window.MissionData = {
    missions: [],
    isLoaded: false,
    loadPromise: null,

    searchMissions(filters) {
      let results = this.missions;

      if (filters.status && filters.status !== 'all') {
        results = results.filter(m => m.status === filters.status);
      }

      if (filters.priority && filters.priority !== 'all') {
        results = results.filter(m => m.priority === filters.priority);
      }

      if (filters.searchText) {
        const text = filters.searchText.toLowerCase();
        // ID完全一致のみ
        results = results.filter(m =>
          m.id.toLowerCase() === text
        );
      }

      if (filters.division) {
        results = results.filter(m =>
          m.assignedDivisions.some(d => d.includes(filters.division))
        );
      }

      return results;
    },

    getMissionById(id) {
      return this.missions.find(m => m.id === id);
    },

    getStatistics() {
      return {
        total: this.missions.length,
        active: this.missions.filter(m => m.status === 'active').length,
        monitoring: this.missions.filter(m => m.status === 'monitoring').length,
        completed: this.missions.filter(m => m.status === 'completed').length,
        critical: this.missions.filter(m => m.priority === 'critical').length
      };
    },

    whenReady() {
      return this.loadPromise;
    }
  };

  async function loadMissionData() {
    try {
      const response = await fetch('./data/mission-data.json');
      if (!response.ok) {
        throw new Error(`Failed to load mission data: ${response.status}`);
      }

      const data = await response.json();
      window.MissionData.missions = data.missions || [];
      window.MissionData.isLoaded = true;

      console.log('Mission data loaded successfully:', {
        missions: window.MissionData.missions.length
      });

      window.dispatchEvent(new CustomEvent('missionDataLoaded'));
      return window.MissionData;
    } catch (error) {
      console.error('Error loading mission data:', error);
      throw error;
    }
  }

  window.MissionData.loadPromise = loadMissionData();
})();
