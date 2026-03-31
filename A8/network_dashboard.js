// References: D3 documentation https://d3js.org/ and the course assignment instructions.
(function () {
    const config = window.dashboardConfig;
    if (!config) {
        throw new Error("dashboardConfig is required.");
    }

    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    const pageSummary = document.getElementById("page-summary");
    const stats = document.getElementById("stats");
    const source = document.getElementById("source");
    const slider = document.getElementById("bundle-slider");
    const sliderValue = document.getElementById("bundle-value");
    const tooltip = d3.select("#tooltip");

    const nodeLinkWidth = 1240;
    const nodeLinkHeight = config.nodeLinkHeight || 780;
    const matrixWidth = 1240;
    const matrixHeight = config.matrixHeight || 1260;

    const nodeLinkSvg = d3.select("#node-link-chart")
        .attr("width", nodeLinkWidth)
        .attr("height", nodeLinkHeight);

    const matrixSvg = d3.select("#matrix-chart")
        .attr("width", matrixWidth)
        .attr("height", matrixHeight);

    Promise.all([
        d3.csv(config.nodesUrl, (d) => ({
            id: +d.id,
            label: d.label,
            degree: +d.degree,
            weightedDegree: +d.weightedDegree,
            community: +d.community,
            matrixOrder: +d.matrixOrder
        })),
        d3.csv(config.linksUrl, (d) => ({
            source: +d.source,
            target: +d.target,
            weight: +d.weight
        }))
    ]).then(([nodes, links]) => {
        const communityCount = new Set(nodes.map((node) => node.community)).size;
        const density = nodes.length > 1 ? (2 * links.length) / (nodes.length * (nodes.length - 1)) : 0;
        const communitySizes = d3.rollup(nodes, (values) => values.length, (node) => node.community);

        pageTitle.textContent = config.title;
        pageSubtitle.textContent = config.subtitle;
        pageSummary.textContent = config.notes;
        stats.textContent = `Nodes: ${nodes.length} | Edges: ${links.length} | Density: ${density.toFixed(4)} | Communities: ${communityCount} | Largest community: ${d3.max(communitySizes.values())}`;
        source.innerHTML = `Source: <a href="${config.sourceUrl}" target="_blank" rel="noreferrer">${config.sourceName}</a>`;

        const graph = { nodes, links, datasetId: config.datasetId };
        renderMatrix(graph);
        renderNodeLink(graph);
    });

    function renderNodeLink(graph) {
        const margin = { top: 20, right: 210, bottom: 20, left: 20 };
        const innerWidth = nodeLinkWidth - margin.left - margin.right;
        const innerHeight = nodeLinkHeight - margin.top - margin.bottom;
        const chart = nodeLinkSvg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const communities = [...new Set(graph.nodes.map((node) => node.community))].sort(d3.ascending);
        const color = d3.scaleOrdinal()
            .domain(communities)
            .range(d3.schemeTableau10.concat(d3.schemeSet3).slice(0, communities.length));

        const degreeExtent = d3.extent(graph.nodes, (node) => node.degree);
        const radius = d3.scaleSqrt()
            .domain([Math.max(1, degreeExtent[0]), degreeExtent[1]])
            .range([4.5, config.maxNodeRadius || 12]);

        const nodes = graph.nodes.map((node) => ({ ...node }));
        const links = graph.links.map((link) => ({ ...link }));
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const linkedNeighbors = new Map(nodes.map((node) => [node.id, new Set([node.id])]));

        links.forEach((link) => {
            linkedNeighbors.get(link.source).add(link.target);
            linkedNeighbors.get(link.target).add(link.source);
        });

        const weightExtent = d3.extent(links, (link) => link.weight);
        const strokeWidth = d3.scaleLinear()
            .domain(weightExtent[0] === weightExtent[1] ? [weightExtent[0], weightExtent[0] + 1] : weightExtent)
            .range([1.1, 4.6]);

        const linkGroup = chart.append("g");
        const nodeGroup = chart.append("g");
        const labelGroup = chart.append("g");

        const legend = nodeLinkSvg.append("g")
            .attr("transform", `translate(${nodeLinkWidth - 185}, 44)`);

        legend.append("text")
            .attr("font-size", "13px")
            .attr("font-weight", "bold")
            .text("Community legend");

        communities.forEach((community, index) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${20 + index * 20})`);

            row.append("rect")
                .attr("width", 14)
                .attr("height", 14)
                .attr("fill", color(community))
                .attr("stroke", "#000");

            row.append("text")
                .attr("x", 22)
                .attr("y", 11)
                .attr("font-size", "12px")
                .text(`Community ${community}`);
        });

        nodeLinkSvg.append("text")
            .attr("x", 20)
            .attr("y", 24)
            .attr("font-size", "15px")
            .attr("font-weight", "bold")
            .text("Force-directed node-link diagram");

        const linkSelection = linkGroup.selectAll("path")
            .data(links)
            .enter()
            .append("path")
            .attr("fill", "none")
            .attr("stroke", "#999")
            .attr("stroke-linecap", "round")
            .attr("stroke-opacity", 0.45)
            .attr("stroke-width", (link) => strokeWidth(link.weight));

        const nodeSelection = nodeGroup.selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
            .attr("r", (node) => radius(node.degree))
            .attr("fill", (node) => color(node.community))
            .attr("stroke", "#000")
            .attr("stroke-width", 0.9);

        const labelSelection = labelGroup.selectAll("text")
            .data(nodes)
            .enter()
            .append("text")
            .attr("font-size", config.labelFontSize || 10)
            .attr("dx", 9)
            .attr("dy", 3)
            .text((node) => node.id);

        const baseLinkDistance = config.linkDistance || (nodes.length > 60 ? 48 : 70);
        const linkDistanceScale = d3.scaleLinear().domain([0, 1]).range([baseLinkDistance * 1.45, baseLinkDistance * 0.72]);
        const linkStrengthScale = d3.scaleLinear().domain([0, 1]).range([0.08, config.maxLinkStrength || 0.52]);
        const chargeStrengthScale = d3.scaleLinear().domain([0, 1]).range([config.minChargeStrength || -40, config.maxChargeStrength || -220]);

        const linkForce = d3.forceLink(links)
            .id((node) => node.id)
            .distance(linkDistanceScale(+slider.value / 100))
            .strength(linkStrengthScale(+slider.value / 100));

        const chargeForce = d3.forceManyBody()
            .strength(chargeStrengthScale(+slider.value / 100));

        const simulation = d3.forceSimulation(nodes)
            .force("link", linkForce)
            .force("charge", chargeForce)
            .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2))
            .force("collision", d3.forceCollide().radius((node) => radius(node.degree) + 5))
            .force("x", d3.forceX(innerWidth / 2).strength(0.03))
            .force("y", d3.forceY(innerHeight / 2).strength(0.03));

        nodeSelection.call(drag(simulation));

        let bundleStrength = +slider.value / 100;
        sliderValue.textContent = bundleStrength.toFixed(2);

        slider.addEventListener("input", (event) => {
            bundleStrength = +event.target.value / 100;
            sliderValue.textContent = bundleStrength.toFixed(2);
            linkForce.distance(linkDistanceScale(bundleStrength));
            linkForce.strength(linkStrengthScale(bundleStrength));
            chargeForce.strength(chargeStrengthScale(bundleStrength));
            simulation.alpha(0.7).restart();
            updateLinks();
        });

        simulation.on("tick", () => {
            nodeSelection
                .attr("cx", (node) => node.x)
                .attr("cy", (node) => node.y);

            labelSelection
                .attr("x", (node) => node.x)
                .attr("y", (node) => node.y);

            updateLinks();
        });

        nodeSelection
            .on("mouseenter", (event, node) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>${node.label}</strong><br/>ID: ${node.id}<br/>Community: ${node.community}<br/>Degree: ${node.degree}<br/>Weighted degree: ${node.weightedDegree.toFixed(0)}`);
                moveTooltip(event);
                applyNodeHighlight(node.id);
                window.updateMatrixHighlight(node.id);
            })
            .on("mousemove", moveTooltip)
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
                clearNodeHighlight();
                window.clearMatrixHighlight();
            });

        function updateLinks() {
            const communityCentroids = new Map();
            communities.forEach((community) => {
                const members = nodes.filter((node) => node.community === community);
                communityCentroids.set(community, {
                    x: d3.mean(members, (node) => node.x ?? innerWidth / 2),
                    y: d3.mean(members, (node) => node.y ?? innerHeight / 2)
                });
            });

            const graphCenter = {
                x: d3.mean(nodes, (node) => node.x ?? innerWidth / 2),
                y: d3.mean(nodes, (node) => node.y ?? innerHeight / 2)
            };

            linkSelection.attr("d", (link) => {
                const sourceNode = resolveNode(link.source);
                const targetNode = resolveNode(link.target);
                const sourceCentroid = communityCentroids.get(sourceNode.community);
                const targetCentroid = communityCentroids.get(targetNode.community);

                const pathPoints = sourceNode.community === targetNode.community
                    ? [
                        [sourceNode.x, sourceNode.y],
                        bundlePoint(sourceNode, targetNode, sourceCentroid, 0.5, bundleStrength),
                        [targetNode.x, targetNode.y]
                    ]
                    : [
                        [sourceNode.x, sourceNode.y],
                        bundlePoint(sourceNode, targetNode, sourceCentroid, 0.3, bundleStrength),
                        blendPoint(midpoint(sourceNode, targetNode), graphCenter, bundleStrength * 0.82),
                        bundlePoint(targetNode, sourceNode, targetCentroid, 0.3, bundleStrength),
                        [targetNode.x, targetNode.y]
                    ];

                return d3.line()
                    .curve(d3.curveBundle.beta(bundleStrength))(pathPoints);
            });
        }

        function applyNodeHighlight(nodeId) {
            const neighbors = linkedNeighbors.get(nodeId);

            nodeSelection
                .attr("opacity", (node) => neighbors.has(node.id) ? 1 : 0.2)
                .attr("stroke-width", (node) => node.id === nodeId ? 2.5 : 0.9);

            labelSelection
                .attr("opacity", (node) => neighbors.has(node.id) ? 1 : 0.18)
                .attr("font-weight", (node) => node.id === nodeId ? "bold" : "normal");

            linkSelection
                .attr("stroke", (link) => resolveId(link.source) === nodeId || resolveId(link.target) === nodeId ? "#000" : "#ccc")
                .attr("stroke-opacity", (link) => resolveId(link.source) === nodeId || resolveId(link.target) === nodeId ? 0.95 : 0.14);
        }

        function clearNodeHighlight() {
            nodeSelection
                .attr("opacity", 1)
                .attr("stroke-width", 0.9);

            labelSelection
                .attr("opacity", 1)
                .attr("font-weight", "normal");

            linkSelection
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.45);
        }

        function drag(force) {
            function dragStarted(event) {
                if (!event.active) {
                    force.alphaTarget(0.25).restart();
                }
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragEnded(event) {
                if (!event.active) {
                    force.alphaTarget(0);
                }
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded);
        }

        function midpoint(sourceNode, targetNode) {
            return [(sourceNode.x + targetNode.x) / 2, (sourceNode.y + targetNode.y) / 2];
        }

        function blendPoint(pointA, pointB, amount) {
            return [
                pointA[0] + (pointB.x - pointA[0]) * amount,
                pointA[1] + (pointB.y - pointA[1]) * amount
            ];
        }

        function bundlePoint(sourceNode, targetNode, centroid, proportion, amount) {
            const basePoint = [
                sourceNode.x + (targetNode.x - sourceNode.x) * proportion,
                sourceNode.y + (targetNode.y - sourceNode.y) * proportion
            ];
            return blendPoint(basePoint, centroid, amount * 0.92);
        }

        function resolveNode(endpoint) {
            return typeof endpoint === "object" ? endpoint : nodeById.get(endpoint);
        }

        function resolveId(endpoint) {
            return typeof endpoint === "object" ? endpoint.id : endpoint;
        }
    }

    function renderMatrix(graph) {
        const margin = { top: 130, right: 34, bottom: 34, left: 130 };
        const innerWidth = matrixWidth - margin.left - margin.right;
        const innerHeight = matrixHeight - margin.top - margin.bottom;
        const chart = matrixSvg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        matrixSvg.append("text")
            .attr("x", 20)
            .attr("y", 24)
            .attr("font-size", "15px")
            .attr("font-weight", "bold")
            .text("Adjacency matrix");

        const nodes = [...graph.nodes].sort((a, b) => d3.ascending(a.matrixOrder, b.matrixOrder));
        const nodeIds = nodes.map((node) => node.id);
        const communityById = new Map(nodes.map((node) => [node.id, node.community]));
        const labelById = new Map(nodes.map((node) => [node.id, node.label]));
        const maxWeight = d3.max(graph.links, (link) => link.weight);
        const weightLookup = new Map();

        graph.links.forEach((link) => {
            weightLookup.set(`${link.source}|${link.target}`, link.weight);
            weightLookup.set(`${link.target}|${link.source}`, link.weight);
        });

        const cellSize = Math.min(innerWidth / nodeIds.length, innerHeight / nodeIds.length);
        const matrixSide = cellSize * nodeIds.length;
        const x = d3.scaleBand().domain(nodeIds).range([0, matrixSide]);
        const y = d3.scaleBand().domain(nodeIds).range([0, matrixSide]);
        const color = d3.scaleSequential().domain([0, maxWeight || 1]).interpolator(d3.interpolateBlues);

        const cells = [];
        nodeIds.forEach((rowId) => {
            nodeIds.forEach((columnId) => {
                cells.push({
                    rowId,
                    columnId,
                    weight: weightLookup.get(`${rowId}|${columnId}`) || 0
                });
            });
        });

        const rowHighlight = chart.append("rect")
            .attr("fill", "#f59e0b")
            .attr("opacity", 0);

        const columnHighlight = chart.append("rect")
            .attr("fill", "#f59e0b")
            .attr("opacity", 0);

        chart.append("rect")
            .attr("width", matrixSide)
            .attr("height", matrixSide)
            .attr("fill", "#fff")
            .attr("stroke", "#000");

        const cellSelection = chart.append("g")
            .selectAll("rect")
            .data(cells)
            .enter()
            .append("rect")
            .attr("x", (cell) => x(cell.columnId))
            .attr("y", (cell) => y(cell.rowId))
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", (cell) => cell.weight > 0 ? color(cell.weight) : "#fff")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 0.35)
            .on("mouseenter", (event, cell) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>${labelById.get(cell.rowId)} to ${labelById.get(cell.columnId)}</strong><br/>Row ID: ${cell.rowId}<br/>Column ID: ${cell.columnId}<br/>Weight: ${cell.weight}`);
                moveTooltip(event);
                setMatrixHighlight(cell.rowId, cell.columnId);
            })
            .on("mousemove", moveTooltip)
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
                clearMatrixHighlight();
            });

        const rowLabels = chart.append("g")
            .selectAll("text")
            .data(nodes)
            .enter()
            .append("text")
            .attr("x", -10)
            .attr("y", (node) => y(node.id) + cellSize / 2)
            .attr("dy", "0.32em")
            .attr("text-anchor", "end")
            .attr("font-size", cellSize < 11 ? 8 : 10)
            .text((node) => node.id)
            .on("mouseenter", (event, node) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>${node.label}</strong><br/>ID: ${node.id}<br/>Community: ${node.community}<br/>Degree: ${node.degree}`);
                moveTooltip(event);
                setMatrixHighlight(node.id, node.id);
            })
            .on("mousemove", moveTooltip)
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
                clearMatrixHighlight();
            });

        const columnLabels = chart.append("g")
            .selectAll("text")
            .data(nodes)
            .enter()
            .append("text")
            .attr("transform", (node) => `translate(${x(node.id) + cellSize / 2}, -10) rotate(-45)`)
            .attr("text-anchor", "start")
            .attr("font-size", cellSize < 11 ? 8 : 10)
            .text((node) => node.id)
            .on("mouseenter", (event, node) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>${node.label}</strong><br/>ID: ${node.id}<br/>Community: ${node.community}<br/>Degree: ${node.degree}`);
                moveTooltip(event);
                setMatrixHighlight(node.id, node.id);
            })
            .on("mousemove", moveTooltip)
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
                clearMatrixHighlight();
            });

        const breaks = [];
        for (let index = 1; index < nodes.length; index += 1) {
            if (communityById.get(nodes[index - 1].id) !== communityById.get(nodes[index].id)) {
                breaks.push(index);
            }
        }

        chart.append("g")
            .selectAll("line")
            .data(breaks)
            .enter()
            .append("line")
            .attr("x1", 0)
            .attr("x2", matrixSide)
            .attr("y1", (breakIndex) => breakIndex * cellSize)
            .attr("y2", (breakIndex) => breakIndex * cellSize)
            .attr("stroke", "#000")
            .attr("stroke-width", 1.1);

        chart.append("g")
            .selectAll("line")
            .data(breaks)
            .enter()
            .append("line")
            .attr("y1", 0)
            .attr("y2", matrixSide)
            .attr("x1", (breakIndex) => breakIndex * cellSize)
            .attr("x2", (breakIndex) => breakIndex * cellSize)
            .attr("stroke", "#000")
            .attr("stroke-width", 1.1);

        matrixSvg.append("text")
            .attr("x", margin.left + matrixSide / 2)
            .attr("y", matrixHeight - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "13px")
            .text("Column node order grouped by community and degree");

        matrixSvg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -(margin.top + matrixSide / 2))
            .attr("y", 18)
            .attr("text-anchor", "middle")
            .attr("font-size", "13px")
            .text("Row node order grouped by community and degree");

        const legendWidth = 180;
        const legendHeight = 12;
        const legendX = matrixWidth - 250;
        const legendY = 40;
        const legendScale = d3.scaleLinear().domain([0, maxWeight || 1]).range([0, legendWidth]);
        const legendGradient = matrixSvg.append("defs")
            .append("linearGradient")
            .attr("id", `${graph.datasetId}-matrix-gradient`);

        d3.range(0, 1.01, 0.1).forEach((stopValue) => {
            legendGradient.append("stop")
                .attr("offset", `${stopValue * 100}%`)
                .attr("stop-color", color((maxWeight || 1) * stopValue));
        });

        matrixSvg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .attr("fill", `url(#${graph.datasetId}-matrix-gradient)`)
            .attr("stroke", "#000");

        matrixSvg.append("g")
            .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
            .call(d3.axisBottom(legendScale).ticks(5));

        matrixSvg.append("text")
            .attr("x", legendX)
            .attr("y", legendY - 8)
            .attr("font-size", "12px")
            .text("Adjacency weight");

        function setMatrixHighlight(rowId, columnId) {
            rowHighlight
                .attr("x", 0)
                .attr("y", y(rowId))
                .attr("width", matrixSide)
                .attr("height", cellSize)
                .attr("opacity", 0.16);

            columnHighlight
                .attr("x", x(columnId))
                .attr("y", 0)
                .attr("width", cellSize)
                .attr("height", matrixSide)
                .attr("opacity", 0.16);

            rowLabels
                .attr("font-weight", (node) => node.id === rowId ? "bold" : "normal");

            columnLabels
                .attr("font-weight", (node) => node.id === columnId ? "bold" : "normal");

            cellSelection
                .attr("stroke", (cell) => cell.rowId === rowId || cell.columnId === columnId ? "#000" : "#ddd")
                .attr("stroke-width", (cell) => cell.rowId === rowId || cell.columnId === columnId ? 0.9 : 0.35);
        }

        function clearMatrixHighlight() {
            rowHighlight.attr("opacity", 0);
            columnHighlight.attr("opacity", 0);
            rowLabels.attr("font-weight", "normal");
            columnLabels.attr("font-weight", "normal");
            cellSelection.attr("stroke", "#ddd").attr("stroke-width", 0.35);
        }

        window.updateMatrixHighlight = function (nodeId) {
            setMatrixHighlight(nodeId, nodeId);
        };

        window.clearMatrixHighlight = function () {
            clearMatrixHighlight();
        };
    }

    function moveTooltip(event) {
        tooltip.style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`);
    }
})();
