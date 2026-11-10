/*
 * Handgeschrieben, ohne Webpack: Das Plugin hat bewusst kein src/main.js,
 * damit bin/build-storefront.sh diese Datei nie anfasst. theme:compile kopiert sie ins Theme.
 */
(function () {
    'use strict';

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    class JubiCountdown extends window.PluginBaseClass {
        init() {
            // Datum im Attribut als YYYY-MM-DD, Start um 0:00 Uhr deutscher Sommerzeit
            this.target = Date.parse(this.el.dataset.jubiCountdown + 'T00:00:00+02:00');
            this.parts = ['days', 'hours', 'minutes', 'seconds'].map((name) => this.el.querySelector('[data-' + name + ']'));
            this.tick();
        }

        tick() {
            const diff = this.target - Date.now();

            if (diff <= 0) {
                this.el.outerHTML = '<p class="jubi-countdown-done">Es ist so weit, wir feiern!</p>';

                return;
            }

            const values = [Math.floor(diff / 864e5), Math.floor(diff / 36e5) % 24, Math.floor(diff / 6e4) % 60, Math.floor(diff / 1e3) % 60];
            this.parts.forEach((part, i) => {
                part.textContent = values[i];
            });

            // Auf die nächste volle Sekunde takten, sonst springen oder doppeln die Sekunden
            setTimeout(() => this.tick(), diff % 1000 + 20);
        }
    }

    /*
     * Scroll Story nach dem Muster der TUGA-Seite: hoher Track, darin eine sticky Bühne.
     * Der Scroll-Fortschritt wird geglättet und blendet die Kapitel (Bild + Text) ineinander über.
     */
    class JubiStory extends window.PluginBaseClass {
        init() {
            // Bei reduzierter Bewegung bleibt die Geschichte als einfache Bild-Text-Folge stehen
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            this.track = this.el.querySelector('.jubi-story-track');
            this.stage = this.el.querySelector('.jubi-story-stage');
            this.chapters = Array.from(this.el.querySelectorAll('.jubi-story-chapter')).map((chapter) => ({
                img: chapter.querySelector('.jubi-story-img'),
                text: chapter.querySelector('.jubi-story-text'),
                el: chapter,
            }));
            this.dots = Array.from(this.el.querySelectorAll('.jubi-story-rail li'));

            this.el.classList.add('is--live');
            this.target = this.progress();
            this.current = this.target;
            this.frame = 0;

            window.addEventListener('scroll', () => this.kick(), { passive: true });
            window.addEventListener('resize', () => this.kick());
            // Wer per Tab zum Button im Schluss springt, soll ihn auch sehen: ans Ende der Story scrollen
            this.el.querySelector('.is--lock').addEventListener('focusin', () => {
                const end = window.scrollY + this.track.getBoundingClientRect().top + this.track.offsetHeight - this.stage.offsetHeight;
                window.scrollTo(0, end);
            });
            this.render(this.current);
        }

        progress() {
            const rect = this.track.getBoundingClientRect();
            const distance = this.track.offsetHeight - this.stage.offsetHeight;

            return distance > 0 ? clamp(-rect.top / distance, 0, 1) : 0;
        }

        kick() {
            this.target = this.progress();

            // Story außer Sicht und nichts in Bewegung: nichts zu tun
            if (this.target === this.current && !this.frame) {
                return;
            }

            if (!this.frame) {
                this.frame = requestAnimationFrame(() => this.tick());
            }
        }

        tick() {
            this.frame = 0;
            this.current += (this.target - this.current) * 0.12;

            if (Math.abs(this.target - this.current) < 0.0005) {
                this.current = this.target;
            }

            this.render(this.current);

            if (this.current !== this.target) {
                this.frame = requestAnimationFrame(() => this.tick());
            }
        }

        render(progress) {
            // Jedes Kapitel steht 60 % seiner Strecke still und blendet erst danach weich zum nächsten über;
            // "- 0.4" gibt auch dem Schlusskapitel seine Haltephase, bevor die Bühne sich löst
            const raw = progress * (this.chapters.length - 0.4);
            const segment = Math.floor(raw);
            const blend = clamp((raw - segment - 0.6) / 0.4, 0, 1);
            const position = segment + blend * blend * (3 - 2 * blend);
            const active = Math.round(position);

            this.chapters.forEach((chapter, i) => {
                const distance = position - i;
                const imageOpacity = clamp(1 - Math.abs(distance), 0, 1);
                const textOpacity = clamp(1 - Math.abs(distance) * 2.5, 0, 1);

                chapter.img.style.opacity = imageOpacity.toFixed(3);
                // Langsamer Zoom, solange das Bild zu sehen ist
                chapter.img.style.transform = 'scale(' + (1.12 - 0.12 * clamp((distance + 1) / 2, 0, 1)).toFixed(4) + ')';
                chapter.text.style.opacity = textOpacity.toFixed(3);
                chapter.text.style.transform = 'translateY(' + (-distance * 40).toFixed(1) + 'px)';
                // Nur das aktive Kapitel ist bedienbar (Button im Schluss)
                chapter.el.classList.toggle('is--active', i === active);
            });

            this.dots.forEach((dot, i) => dot.classList.toggle('is--active', i === active));
        }
    }

    window.PluginManager.register('JubiCountdown', JubiCountdown, '[data-jubi-countdown]');
    window.PluginManager.register('JubiStory', JubiStory, '[data-jubi-story]');
})();
