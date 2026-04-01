// map.js
document.addEventListener("DOMContentLoaded", () => {
  const container = d3.select("#map-container");
  const width = window.innerWidth;
  const height = window.innerHeight;

  const svg = container.append("svg")
    .attr("class", "map-svg")
    .attr("viewBox", [0, 0, width, height]);

  const mapGroup = svg.append("g");

  // Projection and GeoPath
  const projection = d3.geoMercator()
    .scale(200)
    .translate([width / 2, height / 1.5]);

  const path = d3.geoPath().projection(projection);

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 12]) // 1x to 12x zoom
    .on("zoom", (event) => {
      mapGroup.attr("transform", event.transform);
      // scale stroke-width
      mapGroup.selectAll("path")
              .attr("stroke-width", 0.5 / event.transform.k);
    });

  svg.call(zoom);

  // Drawing the map using worldData from index.html -> world_data.js
  if (typeof worldData === "undefined") {
    console.error("worldData is not loaded. Ensure world_data.js is present.");
    return;
  }

  // TopoJSON to GeoJSON
  const countriesData = topojson.feature(worldData, worldData.objects.countries).features;

  // Draw paths
  mapGroup.selectAll("path.country")
    .data(countriesData)
    .enter()
    .append("path")
    .attr("class", "country")
    .attr("id", d => "country-" + d.id)
    .attr("d", path)
    .on("click", function(event, d) {
      if (typeof window.handleCountryClick === "function") {
         window.handleCountryClick(d.id, this);
      }
    });

    // Provide generic map panning/zooming API for game logic
    window.mapAPI = {
       resetColors: () => {
         d3.selectAll(".country").classed("correct", false).classed("wrong", false).classed("reveal", false);
       },
       highlightCorrect: (countryId) => {
         d3.select("#country-" + countryId).classed("correct", true);
       },
       highlightWrong: (domElement) => {
         d3.select(domElement).classed("wrong", true);
       },
       highlightReveal: (countryId) => {
         d3.select("#country-" + countryId).classed("reveal", true);
         // Auto zoom to revealed country
         const pathNode = document.getElementById("country-" + countryId);
         if(pathNode) {
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
});
