function ForceGraph3D() {

	const CAMERA_DISTANCE2NODES_FACTOR = 150;
	class CompProp {
		constructor(name, initVal = null, redigest = true, onChange = newVal => {}) {
			this.name = name;
			this.initVal = initVal;
			this.redigest = redigest;
			this.onChange = onChange;
		}
	}

	const env = {
		initialised: false,
		onFrame: () => {}
	};

	const exposeProps = [
		new CompProp('width', window.innerWidth),
		new CompProp('height', window.innerHeight),
		new CompProp('graphData', {
			nodes: { 1: { name: 'mock', val: 1 } },
			links: [[1, 1]]
		}),
		new CompProp('nodeRelSize', 4), 
		new CompProp('lineOpacity', 0.2),
		new CompProp('valAccessor', node => node.val),
		new CompProp('nameAccessor', node => node.name),
		new CompProp('colorAccessor', node => node.color),
		new CompProp('initialEngineTicks', 0), 
		new CompProp('maxConvergeTime', 15000),
		new CompProp('maxConvergeFrames', 300)
	];

	function initStatic() {
		env.domNode.innerHTML = '';

		const navInfo = document.createElement('div');
		navInfo.classList.add('graph-nav-info');
		navInfo.innerHTML = "MOVE mouse &amp; press LEFT/A: rotate, MIDDLE/S: zoom, RIGHT/D: pan";
		env.domNode.appendChild(navInfo);

		env.toolTipElem = document.createElement('div');
		env.toolTipElem.classList.add('graph-tooltip');
		env.domNode.appendChild(env.toolTipElem);

		env.raycaster = new THREE.Raycaster();
		env.mouse = new THREE.Vector2();
		env.mouse.x = -2;
		env.mouse.y = -2;
		env.domNode.addEventListener("mousemove", ev => {
			const offset = getOffset(env.domNode),
				relPos = {
					x: ev.pageX - offset.left,
					y: ev.pageY - offset.top
				};
			env.mouse.x = (relPos.x / env.width) * 2 - 1;
			env.mouse.y = -(relPos.y / env.height) * 2 + 1;

			env.toolTipElem.style.top = (relPos.y - 40) + 'px';
			env.toolTipElem.style.left = (relPos.x - 20) + 'px';

			function getOffset(el) {
				const rect = el.getBoundingClientRect(),
					scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
					scrollTop = window.pageYOffset || document.documentElement.scrollTop;
				return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
			}
		}, false);

		env.camera = new THREE.PerspectiveCamera();
		env.camera.far = 20000;
		env.camera.position.z = 1000;
		env.scene = new THREE.Scene();
		env.renderer = new THREE.WebGLRenderer();
		env.domNode.appendChild(env.renderer.domElement);
		env.controls = new THREE.TrackballControls(env.camera, env.renderer.domElement);
		env.initialised = true;

		(function animate() {
			env.onFrame();

			env.raycaster.setFromCamera(env.mouse, env.camera);
			const intersects = env.raycaster.intersectObjects(env.scene.children);
			env.toolTipElem.innerHTML = intersects.length ? intersects[0].object.name || '' : '';
//			env.toolTipElem.innerHTML = intersects.length ? intersects[0].graphData.nodes.name || '' : '';
			env.controls.update();
			env.renderer.render(env.scene, env.camera);
			requestAnimationFrame(animate);
		})()
	}

	function digest() {
		if (!env.initialised) { return }
			resizeCanvas();

		env.onFrame = ()=>{};
		env.scene = new THREE.Scene();
		const graph = ngraph.graph();
		for (let nodeId in env.graphData.nodes) {
			graph.addNode(nodeId, env.graphData.nodes[nodeId]);
		}
		for (let link of env.graphData.links) {
			graph.addLink(...link, {});
		}

		graph.forEachNode(node => {
			const nodeMaterial = new THREE.MeshBasicMaterial({ color: env.colorAccessor(node.data) || 0xffffaa, transparent: true });
			nodeMaterial.opacity = 0.75;

			const sphere = new THREE.Mesh(
				new THREE.SphereGeometry(Math.cbrt(env.valAccessor(node.data) || 1) * env.nodeRelSize),
				nodeMaterial
			);
			sphere.name = env.nameAccessor(node.data) || '';

			env.scene.add(node.data.sphere = sphere)
		});

		const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, transparent: true });
		lineMaterial.opacity = env.lineOpacity;
		graph.forEachLink(link => {
			const line = new THREE.Line(new THREE.Geometry(), lineMaterial);
			line.name = `${getNodeName(link.fromId)} > ${getNodeName(link.toId)}`;

			env.scene.add(link.data.line = line)

			function getNodeName(nodeId) {
				return env.nameAccessor(graph.getNode(nodeId).data);
			}
		});

		env.camera.lookAt(env.scene.position);
		env.camera.position.z = Math.cbrt(Object.keys(env.graphData.nodes).length) * CAMERA_DISTANCE2NODES_FACTOR;

		const layout = ngraph.forcelayout3d(graph);

		for (let i=0; i<env.initialEngineTicks; i++) { layout.step(); }
		let cntTicks = 0;
		const startTickTime = new Date();
		env.onFrame = layoutTick;

		//

		function resizeCanvas() {
			if (env.width && env.height) {
				env.renderer.setSize(env.width, env.height);
				env.camera.aspect = env.width/env.height;
				env.camera.updateProjectionMatrix();
			}
		}

		function layoutTick() {
			if (cntTicks++ > env.maxConvergeFrames || (new Date()) - startTickTime > env.maxConvergeTime) {
				env.onFrame = ()=>{};
			}

			layout.step();

			graph.forEachNode(node => {
				const sphere = node.data.sphere,
					pos = layout.getNodePosition(node.id);

				sphere.position.x = pos.x;
				sphere.position.y = pos.y;
				sphere.position.z = pos.z;
			});

			graph.forEachLink(link => {
				const line = link.data.line,
					pos = layout.getLinkPosition(link.id);

				line.geometry.vertices = [
					new THREE.Vector3(pos.from.x, pos.from.y, pos.from.z),
					new THREE.Vector3(pos.to.x, pos.to.y, pos.to.z)
				];

				line.geometry.verticesNeedUpdate = true;
			})
		}
	}

	function chart(nodeElement) {
		env.domNode = nodeElement;

		initStatic();
		digest();

		return chart;
	}

	exposeProps.forEach(prop => {
		chart[prop.name] = getSetEnv(prop.name, prop.redigest, prop.onChange);
		env[prop.name] = prop.initVal;
		prop.onChange(prop.initVal);

		function getSetEnv(prop, redigest = false,  onChange = newVal => {}) {
			return _ => {
				if (!arguments.length) { return env[prop] }
				env[prop] = _;
				onChange(_);
				if (redigest) { digest() }
				return chart;
			}
		}
	});

	chart.resetState = function() {
		this.graphData({nodes: [], links: []})
			.nodeRelSize(4)
			.lineOpacity(0.2)
			.valAccessor(node => node.val)
			.nameAccessor(node => node.name)
			.colorAccessor(node => node.color)
			.initialEngineTicks(0)
			.maxConvergeTime(15000) 
			.maxConvergeFrames(300);

		return this;
	};

	chart.resetState(); 

	return chart;
}