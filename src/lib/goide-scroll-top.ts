// GoIDE: al entrar a otra pagina, sube hasta arriba (ventana y contenedor principal con scroll propio).
// Solo en navegacion nueva: los enlaces #seccion y el boton "atras" se comportan como siempre.
if (typeof window !== "undefined") {
  const w = window as unknown as { __goideScrollTop?: boolean };
  if (!w.__goideScrollTop) {
    w.__goideScrollTop = true;
    const subir = () => {
      window.scrollTo(0, 0);
      document.querySelectorAll<HTMLElement>("main, [data-scroll-container]").forEach((el) => {
        if (el.scrollHeight > el.clientHeight) el.scrollTop = 0;
      });
    };
    const original = window.history.pushState.bind(window.history);
    window.history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      const antes = window.location.pathname;
      original(data, unused, url);
      if (window.location.pathname !== antes) requestAnimationFrame(() => requestAnimationFrame(subir));
    };
  }
}
export {};
