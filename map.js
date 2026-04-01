// map.js - 모바일 터치 + Seamless 좌우연결 + 소국 터치 정확도
document.addEventListener("DOMContentLoaded", () => {
  const container = d3.select("#map-container");
  let width = window.innerWidth;
  let height = window.innerHeight;
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const svg = container.append("svg")
    .attr("class", "map-svg")
    .attr("viewBox", [0, 0, width, height]);

  const mapGroup = svg.append("g");

  // 프로젝션 (모바일은 화면 비례 스케일)
  const projScale = width < 500 ? width / 5 : 200;
  const projection = d3.geoMercator()
    .scale(projScale)
    .translate([width / 2, height / 1.5]);
  const path = d3.geoPath().projection(projection);

  // Seamless 래핑용 지도 픽셀 폭 (경도 360° 전체)
  const mapPixelWidth = 2 * Math.PI * projScale;

  // ─── 줌 동작 ───
  let isWrapping = false;
  const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .on("zoom", (event) => {
      mapGroup.attr("transform", event.transform);
      mapGroup.selectAll("path.country")
        .attr("stroke-width", 0.5 / event.transform.k);
    })
    .on("end", (event) => {
      // Seamless 래핑: 1맵폭 이상 이동 시 조용히 리셋
      if (isWrapping) return;
      const t = event.transform;
      const effW = mapPixelWidth * t.k;
      const snapped = t.x - Math.round(t.x / effW) * effW;
      if (Math.abs(snapped - t.x) > 1) {
        isWrapping = true;
        svg.call(zoom.transform, d3.zoomIdentity.translate(snapped, t.y).scale(t.k));
        isWrapping = false;
      }
    });

  svg.call(zoom).on("dblclick.zoom", null);

  // 브라우저 기본 터치 동작 차단 (D3 줌이 전담)
  const svgNode = svg.node();
  svgNode.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  svgNode.addEventListener("touchmove", e => e.preventDefault(), { passive: false });

  // ─── 데이터 로드 ───
  if (typeof worldData === "undefined") {
    console.error("worldData is not loaded.");
    return;
  }
  const countriesData = topojson.feature(worldData, worldData.objects.countries).features;

  // ─── 지도 3벌 렌더링 (Seamless 좌우 연결) ───
  [-1, 0, 1].forEach(offset => {
    const g = mapGroup.append("g")
      .attr("transform", `translate(${offset * mapPixelWidth}, 0)`);

    g.selectAll("path.country")
      .data(countriesData)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("data-country-id", d => d.id)
      .attr("d", path)
      .on("click", function(event, d) {
        if (typeof window.handleCountryClick === "function") {
          window.handleCountryClick(d.id, this);
        }
      });
  });

  // ─── 모바일 터치 탭 감지 (D3 줌과 공존) ───
  if (isMobile) {
    let tap = { time: 0, x: 0, y: 0, moved: false, active: false };

    svgNode.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        tap = { time: Date.now(), x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false, active: true };
      } else {
        tap.active = false;
      }
    }, { passive: true });

    svgNode.addEventListener("touchmove", (e) => {
      if (!tap.active || !e.touches[0]) return;
      const dx = e.touches[0].clientX - tap.x;
      const dy = e.touches[0].clientY - tap.y;
      if (dx * dx + dy * dy > 100) tap.moved = true;
    }, { passive: true });

    svgNode.addEventListener("touchend", (e) => {
      if (!tap.active || tap.moved || Date.now() - tap.time > 300) {
        tap.active = false;
        return;
      }
      tap.active = false;

      // 직접 히트 또는 근접 탐색
      let el = document.elementFromPoint(tap.x, tap.y);
      if (!el || !el.classList.contains('country')) {
        el = findNearestCountry(tap.x, tap.y, 25);
      }
      if (el) {
        const d = d3.select(el).datum();
        if (d && typeof window.handleCountryClick === "function") {
          window.handleCountryClick(d.id, el);
        }
      }
    }, { passive: true });

    // 근접 국가 탐색 (반경 내 가장 가까운 국가 탐색)
    function findNearestCountry(cx, cy, radius) {
      for (let r = 4; r <= radius; r += 4) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const el = document.elementFromPoint(cx + r * Math.cos(a), cy + r * Math.sin(a));
          if (el && el.classList.contains('country')) return el;
        }
      }
      return null;
    }
  }

  // ─── 맵 API (게임 로직용) ───
  window.mapAPI = {
    resetColors: () => {
      d3.selectAll(".country").classed("correct", false).classed("wrong", false).classed("reveal", false);
    },
    highlightCorrect: (countryId) => {
      d3.selectAll(`[data-country-id="${countryId}"]`).classed("correct", true);
    },
    highlightWrong: (domElement) => {
      const cid = domElement.getAttribute("data-country-id");
      if (cid) d3.selectAll(`[data-country-id="${cid}"]`).classed("wrong", true);
    },
    highlightReveal: (countryId) => {
      d3.selectAll(`[data-country-id="${countryId}"]`).classed("reveal", true);
      const nodes = document.querySelectorAll(`[data-country-id="${countryId}"]`);
      const pathNode = nodes[1] || nodes[0]; // 중앙 복사본 우선
      if (pathNode) {
        const d = d3.select(pathNode).datum();
        const bounds = path.bounds(d);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      }
    },
    resetZoom: () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
  };

  // 화면 회전/리사이즈 대응
  window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    svg.attr("viewBox", [0, 0, width, height]);
  });
});
