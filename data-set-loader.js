function getGraphDataSets() {

    const colors = ['#FF0000'];  //Stranger Things Logo RED

    const loadGroups = function(Graph) {
        qwest.get('stdata.json').then((_, data) => {
            const nodes = {};

            data.nodes.forEach((node, i) => { 
                node.id = i;
                node.groupLabel =  node.group;
                node.group = Number(node.group.split(' ')[1]) || 0;
                nodes[node.id] = node;
            });

            console.log('data from loadGroups', data);
            console.log('nodes from loadGroups', nodes);

            Graph
                .resetState()
                .nameAccessor(node => node.id)
                .colorAccessor(node => parseInt(colors[node.group%colors.length].slice(1),16))
                .graphData({
                    nodes: nodes,
                    links: data.links.map(link => [link.source, link.target])
                });
        });
    };
    loadGroups.description = "<em>Stranger Things Script</em> data (<a href='https://upload.wikimedia.org/wikipedia/commons/3/38/Stranger_Things_logo.png'>Stranger Things</a>)";

    //

    return [loadGroups];
}