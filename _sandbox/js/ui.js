const items = [{
      id: 'ex-1',
      section: 'Exercise',
      name: 'Bicep curl',
      detail: '4×8 · 60kg'
   },{
      id: 'ex-2',
      section: 'Exercise',
      name: 'Tricep curl',
      detail: '3×8 · 40kg'
   },{
      id: 'ex-3',
      section: 'Core',
      name: 'Plank',
      detail: '3×8 · 60seconds'
   },
];
const completedItemsLocalStorageKey = 'completedItems';
const completedItems = loadCompleted();

render();

function render() {
   const workout = groupBySection(items);
   const appInnerHtml = Object.keys(workout).map( sectionName => {
      const section = workout[sectionName].map(item =>(
         `
         <div class="${completedItems.has(item.id) ? "done" : "not-done"}" onclick='toggleItem("${item.id}")'>
            <h3>${item.name}</h3>
            <p>${item.detail}</p>
         </div>`
      )).join('');
      const bucketWorkout = `
         <h2>${sectionName}</h2>
         ${section}
      `;
      return bucketWorkout;
   }).join('');
   const app = document.getElementById('app');
   app.innerHTML = appInnerHtml;
}

function groupBySection(items) {
   const buckets = {};
   items.forEach(item => {
      const isMissingBucket = !buckets[item.section];
      if(isMissingBucket) {
         buckets[item.section] = [];
      }
      buckets[item.section].push(item);
   })
   return buckets;
}

function toggleItem(id) {
   if(completedItems.has(id))
      completedItems.delete(id);
   else 
      completedItems.add(id);
   saveCompleted();
   render();
}

function saveCompleted() {
   const storedCompletedItemsJson = JSON.stringify([...completedItems]);
   try {
      localStorage.setItem(completedItemsLocalStorageKey, storedCompletedItemsJson);
   } catch (error) {}
}

function loadCompleted() {
   try {
      const storedCompletedItemsJson = localStorage.getItem(completedItemsLocalStorageKey) || '[]';
      const parsedCompletedItems = new Set(JSON.parse(storedCompletedItemsJson));
      return parsedCompletedItems;
   } catch (error) {
      return new Set();
   }
}