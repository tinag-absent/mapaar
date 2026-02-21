// Personnel Database - JSON Loader (LEVEL 5 CLASSIFIED)
(function() {
  window.PersonnelDatabase = {
    personnel: [],
    isLoaded: false,
    loadPromise: null,

    searchPersonnel(query) {
      const lowerQuery = query.toLowerCase();
      return this.personnel.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.id.toLowerCase().includes(lowerQuery) ||
        p.division.toLowerCase().includes(lowerQuery) ||
        p.specialization.toLowerCase().includes(lowerQuery)
      );
    },

    getPersonnelById(id) {
      return this.personnel.find(p => p.id === id);
    },

    filterByDivision(division) {
      return this.personnel.filter(p => p.division.includes(division));
    },

    getStatistics() {
      const divisions = {};
      this.personnel.forEach(p => {
        const div = p.division.split(' ')[0];
        divisions[div] = (divisions[div] || 0) + 1;
      });

      return {
        total: this.personnel.length,
        divisions: divisions,
        avgAge: Math.round(this.personnel.reduce((sum, p) => sum + p.age, 0) / this.personnel.length)
      };
    },

    whenReady() {
      return this.loadPromise;
    }
  };

  async function loadPersonnelData() {
    try {
      const response = await fetch('./data/personnel-data.json');
      if (!response.ok) {
        throw new Error(`Failed to load personnel data: ${response.status}`);
      }

      const data = await response.json();
      window.PersonnelDatabase.personnel = data.personnel || [];
      window.PersonnelDatabase.isLoaded = true;

      console.log('Personnel data loaded successfully:', {
        personnel: window.PersonnelDatabase.personnel.length
      });

      window.dispatchEvent(new CustomEvent('personnelDataLoaded'));
      return window.PersonnelDatabase;
    } catch (error) {
      console.error('Error loading personnel data:', error);
      throw error;
    }
  }

  window.PersonnelDatabase.loadPromise = loadPersonnelData();
})();
