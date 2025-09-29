// Minimal JS to mock field/worker options and handle submit
document.addEventListener('DOMContentLoaded', () => {
  const fieldSelect = document.getElementById('fieldSelect');
  const workerSelect = document.getElementById('workerSelect');
  const filterDriver = document.getElementById('filterDriver');
  const form = document.getElementById('taskForm');
  const cancelBtn = document.getElementById('cancelBtn');

  const fields = ['Lot A1 - Naungan', 'Lot B2 - Ipil', 'Lot C3 - Linao'];
  const workers = [
    { name: 'Maria Sanchez', driver: false },
    { name: 'Peter Romero', driver: true },
    { name: 'Anna Reyes', driver: false },
    { name: 'Carl Ramos', driver: true }
  ];

  fields.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f; fieldSelect.appendChild(opt);
  });

  function renderWorkers() {
    workerSelect.innerHTML = '<option value="">Select worker…</option>';
    const onlyDriver = filterDriver.checked;
    workers.filter(w => !onlyDriver || w.driver).forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.name; opt.textContent = w.name + (w.driver ? ' (Driver)' : '');
      workerSelect.appendChild(opt);
    });
  }
  filterDriver.addEventListener('change', renderWorkers);
  renderWorkers();

  cancelBtn.addEventListener('click', () => history.back());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Task assigned successfully.');
  });
});


