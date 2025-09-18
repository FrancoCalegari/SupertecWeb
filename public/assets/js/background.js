document.addEventListener("DOMContentLoaded", () => {
    const backgrounds = {
        hero: "assets/img/fondos/fondo1.jpg",
        servicios: "assets/img/fondos/fondo2.jpeg",
        faqs: "assets/img/fondos/fondo3.jpg",
        contacto: "assets/img/fondos/fondo4.jpg"
    };

    const bgImage = document.getElementById("bgImage");

    function changeBackground() {
        let scrollPos = window.scrollY + window.innerHeight / 2;

        document.querySelectorAll("section, footer").forEach(section => {
            const rect = section.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const bottom = top + rect.height;

            if (scrollPos >= top && scrollPos <= bottom) {
                let id = section.getAttribute("id");
                if (backgrounds[id] && bgImage.src.indexOf(backgrounds[id]) === -1) {
                    bgImage.style.opacity = 0;
                    setTimeout(() => {
                        bgImage.src = backgrounds[id];
                        bgImage.style.opacity = 1;
                    }, 700);
                }
            }
        });
    }

    window.addEventListener("scroll", changeBackground);
    changeBackground(); // Inicial
});

document.addEventListener('DOMContentLoaded', function() {
    const wrappers = document.querySelectorAll('.brand-logos-wrapper');

    wrappers.forEach(wrapper => {
        const container = wrapper.querySelector('.brand-logos');
        const logos = Array.from(container.children);
        
        // Duplica los logos para crear el efecto de loop infinito
        logos.forEach(logo => container.appendChild(logo.cloneNode(true)));
        
        let position = 0;
        const scrollSpeed = 0.7; // Velocidad de desplazamiento

        // Calcula el ancho de un logo + margen y el total de la primera fila
        const logoWidth = logos[0].offsetWidth + parseInt(getComputedStyle(logos[0]).marginRight);
        const totalWidth = logoWidth * logos.length;
        
        function moveLogos() {
            position -= scrollSpeed;
            
            // Si la posición ha superado el ancho de la primera copia, se reinicia
            if (Math.abs(position) >= totalWidth) {
                position = 0;
            }
            
            container.style.transform = `translateX(${position}px)`;
            requestAnimationFrame(moveLogos);
        }
        
        moveLogos();
    });
});




document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('open');
    });
});
