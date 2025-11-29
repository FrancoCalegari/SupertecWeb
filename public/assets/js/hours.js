document.addEventListener('DOMContentLoaded', async () => {
    const statusContainer = document.getElementById('status-container');
    const scheduleGrid = document.querySelector('.schedule-grid');
    
    if (!statusContainer || !scheduleGrid) return;

    try {
        const res = await fetch('/api/horarios');
        const horarios = await res.json(); // Array de objetos {day, open, close, closed}

        // 1. Renderizar Grilla
        scheduleGrid.innerHTML = '';
        horarios.forEach(h => {
            const item = document.createElement('div');
            item.className = `schedule-item ${h.closed ? 'closed' : ''}`;
            
            let timeText = 'Cerrado';
            if (!h.closed) {
                // Convertir 24h a 12h AM/PM para mostrar bonito
                const formatTime = (t) => {
                    const [hh, mm] = t.split(':');
                    let hNum = parseInt(hh);
                    const ampm = hNum >= 12 ? 'p.m.' : 'a.m.';
                    if (hNum > 12) hNum -= 12;
                    if (hNum === 0) hNum = 12;
                    return `${hNum}:${mm} ${ampm}`;
                };
                timeText = `${formatTime(h.open)} – ${formatTime(h.close)}`;
            }

            item.innerHTML = `
                <span class="day">${h.day}</span>
                <span class="time">${timeText}</span>
            `;
            scheduleGrid.appendChild(item);
        });

        // 2. Calcular Estado Actual
        const now = new Date();
        // getDay(): 0=Domingo, 1=Lunes... 6=Sábado
        // Nuestro array horarios suele empezar en Lunes (index 0) o Domingo?
        // El array default es: Lunes, Martes, ..., Domingo.
        // Mapeo de getDay() a índice del array:
        // 0 (Dom) -> 6
        // 1 (Lun) -> 0
        let dayIndex = now.getDay() - 1;
        if (dayIndex < 0) dayIndex = 6; // Domingo

        const todaySchedule = horarios[dayIndex];
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let isOpen = false;
        if (!todaySchedule.closed) {
            const [openH, openM] = todaySchedule.open.split(':').map(Number);
            const [closeH, closeM] = todaySchedule.close.split(':').map(Number);
            const startMinutes = openH * 60 + openM;
            const endMinutes = closeH * 60 + closeM;
            
            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                isOpen = true;
            }
        }

        const statusText = document.createElement('p');
        statusText.className = isOpen ? 'status-open' : 'status-closed';
        
        if (isOpen) {
            statusText.innerHTML = '<i class="fa-solid fa-store"></i> Abierto ahora';
        } else {
            statusText.innerHTML = '<i class="fa-solid fa-store-slash"></i> Cerrado ahora - <a href="https://wa.me/5492615031101" target="_blank">Déjanos un mensaje</a>';
        }

        statusContainer.innerHTML = ''; // Limpiar previo
        statusContainer.appendChild(statusText);

    } catch (err) {
        console.error('Error cargando horarios', err);
        statusContainer.innerHTML = '<p>Horarios no disponibles</p>';
    }
});
