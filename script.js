(function() {
    'use strict';

    // ----- ДАННЫЕ -----
    let expenses = [];
    const STORAGE_KEY = 'expenseTrackerData';

    // DOM-ссылки
    const form = document.getElementById('expenseForm');
    const descInput = document.getElementById('descInput');
    const amountInput = document.getElementById('amountInput');
    const categorySelect = document.getElementById('categorySelect');
    const dateInput = document.getElementById('dateInput');
    const expenseList = document.getElementById('expenseList');
    const totalAmountEl = document.getElementById('totalAmount');
    const statsCount = document.getElementById('statsCount');
    const filterCategory = document.getElementById('filterCategory');
    const searchInput = document.getElementById('searchInput');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const chartBars = document.getElementById('chartBars');

    // ----- ЗАГРУЗКА ИЗ LOCALSTORAGE -----
    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    expenses = parsed;
                    return;
                }
            }
        } catch (_) { /* игнор */ }
        expenses = [];
    }

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    }

    // ----- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -----
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ----- РЕНДЕРИНГ -----
    function render() {
        // 1. Фильтрация
        const catFilter = filterCategory.value;
        const searchTerm = searchInput.value.trim().toLowerCase();

        let filtered = expenses.filter(e => {
            const matchCat = catFilter === 'all' || e.category === catFilter;
            const matchSearch = e.description.toLowerCase().includes(searchTerm);
            return matchCat && matchSearch;
        });

        // Сортировка: новые сверху (по дате и id)
        filtered.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.id.localeCompare(a.id);
        });

        // 2. Общая сумма
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);
        totalAmountEl.textContent = total.toFixed(2) + ' ₽';
        totalAmountEl.className = 'amount' + (total < 0 ? ' negative' : '');

        // 3. Счётчик
        statsCount.textContent = filtered.length + ' ' + declension(filtered.length, ['запись', 'записи', 'записей']);

        // 4. Список
        if (filtered.length === 0) {
            expenseList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Нет расходов</h3>
                    <p>Добавьте первый расход, чтобы начать отслеживать бюджет.</p>
                </div>
            `;
        } else {
            let html = '';
            filtered.forEach(e => {
                const catEmoji = getCategoryEmoji(e.category);
                html += `
                    <div class="expense-item" data-id="${e.id}">
                        <div class="info">
                            <span class="desc">${escapeHtml(e.description)}</span>
                            <span class="category">${catEmoji} ${escapeHtml(e.category)}</span>
                            <span class="date">📅 ${formatDate(e.date)}</span>
                        </div>
                        <span class="amount negative">- ${e.amount.toFixed(2)} ₽</span>
                        <div class="actions">
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${e.id}">✕</button>
                        </div>
                    </div>
                `;
            });
            expenseList.innerHTML = html;

            // Обработчики на кнопки удаления
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    const id = this.dataset.id;
                    deleteExpense(id);
                });
            });
        }

        // 5. Диаграмма
        renderChart(filtered);

        // 6. Сохранить в storage
        saveToStorage();
    }

    // ----- ДИАГРАММА -----
    function renderChart(filtered) {
        // Группируем по категориям (из отфильтрованного списка)
        const map = new Map();
        filtered.forEach(e => {
            const cat = e.category;
            map.set(cat, (map.get(cat) || 0) + e.amount);
        });

        const entries = Array.from(map.entries());
        if (entries.length === 0) {
            chartBars.innerHTML = `<div class="no-chart">Нет данных для диаграммы</div>`;
            return;
        }

        // Находим максимум для масштабирования
        const maxVal = Math.max(...entries.map(([, v]) => v), 1);

        let html = '';
        // Сортируем по убыванию суммы
        entries.sort((a, b) => b[1] - a[1]);

        for (const [cat, sum] of entries) {
            const percent = Math.max((sum / maxVal) * 100, 4);
            const emoji = getCategoryEmoji(cat);
            html += `
                <div class="chart-bar-wrap">
                    <div class="cat-total">${sum.toFixed(0)} ₽</div>
                    <div class="chart-bar" style="height: ${percent}px; background: ${getCategoryColor(cat)};"></div>
                    <div class="cat-label">${emoji} ${cat}</div>
                </div>
            `;
        }
        chartBars.innerHTML = html;
    }

    // ----- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КАТЕГОРИЙ -----
    function getCategoryEmoji(cat) {
        const map = {
            'Еда': '🍔',
            'Транспорт': '🚗',
            'Жильё': '🏠',
            'Развлечения': '🎮',
            'Здоровье': '💊',
            'Одежда': '👕',
            'Другое': '📦'
        };
        return map[cat] || '📦';
    }

    function getCategoryColor(cat) {
        const map = {
            'Еда': '#f39c12',
            'Транспорт': '#3498db',
            'Жильё': '#9b59b6',
            'Развлечения': '#e67e22',
            'Здоровье': '#2ecc71',
            'Одежда': '#e74c5e',
            'Другое': '#95a5a6'
        };
        return map[cat] || '#4f7df3';
    }

    function declension(n, forms) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return forms[2];
        if (mod10 === 1) return forms[0];
        if (mod10 >= 2 && mod10 <= 4) return forms[1];
        return forms[2];
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ----- ДОБАВЛЕНИЕ РАСХОДА -----
    function addExpense(e) {
        e.preventDefault();

        const description = descInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const category = categorySelect.value;
        const date = dateInput.value;

        if (!description) {
            alert('Введите описание расхода.');
            return;
        }
        if (!amount || amount <= 0) {
            alert('Введите корректную сумму (больше 0).');
            return;
        }
        if (!date) {
            alert('Выберите дату.');
            return;
        }

        const newExpense = {
            id: generateId(),
            description,
            amount,
            category,
            date,
        };

        expenses.push(newExpense);
        render();

        // Очистка формы
        descInput.value = '';
        amountInput.value = '';
        dateInput.value = '';
        descInput.focus();

        // Прокрутка к началу списка
        expenseList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ----- УДАЛЕНИЕ -----
    function deleteExpense(id) {
        if (!confirm('Удалить этот расход?')) return;

        // Анимация удаления
        const item = document.querySelector(`.expense-item[data-id="${id}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                expenses = expenses.filter(e => e.id !== id);
                render();
            }, 250);
        } else {
            expenses = expenses.filter(e => e.id !== id);
            render();
        }
    }

    // ----- ОЧИСТКА ФИЛЬТРОВ -----
    function clearFilters() {
        filterCategory.value = 'all';
        searchInput.value = '';
        render();
    }

    // ----- ИНИЦИАЛИЗАЦИЯ -----
    function init() {
        loadFromStorage();

        // Установка сегодняшней даты в поле
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;

        render();

        // События
        form.addEventListener('submit', addExpense);
        filterCategory.addEventListener('change', render);
        searchInput.addEventListener('input', render);
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    // Запуск
    document.addEventListener('DOMContentLoaded', init);
})();