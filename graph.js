import { Vec2, abs_v2, cross_v2, dot_v2 } from "./utils.js";

const canvas = document.getElementById('automaton');
const ctx = canvas.getContext('2d');

class GraphNode
{
    pos;
    force;

    constructor(pos)
    {
        this.pos = pos;
        this.force = new Vec2(0, 0);
    }
}

class Graph
{
    nodes;
    edges;

    constructor(nodes, edges)
    {
        this.nodes = nodes;
        this.edges = edges;
    }

    are_connected(src, dst)
    {
        return this.edges.has(src * this.nodes.length + dst);
    }

    draw()
    {
        for (let edge of this.edges)
        {
            let src = edge / this.nodes.length | 0;
            let dst = edge % this.nodes.length;

            if (this.are_connected(dst, src))
                draw_arc_between_two_points(this.nodes[src].pos, this.nodes[dst].pos, 12);
            else
                draw_line_between_two_points(this.nodes[src].pos, this.nodes[dst].pos);
        }

        for (let node of this.nodes)
            draw_point(node.pos);
    }
};

class Triangle
{
    corner0;
    corner1;
    corner2;

    constructor(corner0, corner1, corner2)
    {
        this.corner0 = corner0;
        this.corner1 = corner1;
        this.corner2 = corner2;
    }

    draw()
    {
        ctx.beginPath();
        ctx.moveTo(this.corner0.x, this.corner0.y);
        ctx.lineTo(this.corner1.x, this.corner1.y);
        ctx.lineTo(this.corner2.x, this.corner2.y);
        ctx.lineTo(this.corner0.x, this.corner0.y);
        ctx.fill();
    }
};

class Arc
{
    center;
    radius;
    start_angle;
    end_angle;
    is_counter_clockwise;

    constructor(center, radius, start_angle, end_angle, is_counter_clockwise)
    {
        this.center = center;
        this.radius = radius;
        this.start_angle = start_angle;
        this.end_angle = end_angle;
        this.is_counter_clockwise = is_counter_clockwise;
    }

    draw()
    {
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.radius, this.start_angle, this.end_angle, this.is_counter_clockwise);
        ctx.stroke();
    }
};

function graph_from_adjacency_list(adjacency_list)
{
    let graph = new Graph([], new Set());

    let src = 0;
    for (let neighboors of adjacency_list)
    {
        for (let dst of neighboors)
            graph.edges.add(src * adjacency_list.length + dst);

        graph.nodes.push(new GraphNode(new Vec2(0, 0)));
        ++src;
    }

    return graph;
}

function randomly_distribute_nodes(graph, width, height, xmargin, ymargin)
{
    for (let node of graph.nodes)
    {
        let x = Math.random();
        let y = Math.random();
        x *= width - xmargin;
        y *= height - ymargin;
        x += xmargin / 2;
        y += ymargin / 2;
        node.pos.x = x;
        node.pos.y = y;
    }
}

function layout_nodes(graph, repulsive_constant, attractive_constant, ideal_length)
{
    for (let t = 0; t < 1024; t++)
    {
        for (let i = 0; i < graph.nodes.length; i++)
        {
            let src_node = graph.nodes[i];

            for (let j = i + 1; j < graph.nodes.length; j++)
            {
                let dst_node = graph.nodes[j];
                let src = src_node.pos;
                let dst = dst_node.pos;
                let disp = new Vec2(dst.x - src.x, dst.y - src.y);
                let dist = abs_v2(disp, 0);
                disp.x /= dist;
                disp.y /= dist;

                let factor = graph.are_connected(i, j) || graph.are_connected(j, i) ?
                    attractive_constant * Math.log(dist / ideal_length) :
                    -repulsive_constant / (dist * dist);

                disp.x *= factor;
                disp.y *= factor;
                src_node.force.x += disp.x;
                src_node.force.y += disp.y;
                dst_node.force.x -= disp.x;
                dst_node.force.y -= disp.y;
            }
        }

        const delta = 2 * Math.exp(-t * 0.001);

        for (let node of graph.nodes)
        {
            node.pos.x += delta * node.force.x;
            node.pos.y += delta * node.force.y;
            node.force.x = 0;
            node.force.y = 0;
        }
    }
}

function arc_through_three_points(a, b, c)
{
    let ac = new Vec2(c.x - a.x, c.y - a.y);
    let ab = new Vec2(b.x - a.x, b.y - a.y);
    let bc = new Vec2(c.x - b.x, c.y - b.y);
    let cross = cross_v2(ab, bc);
    let lambda = dot_v2(ac, ab) / cross;
    let center = new Vec2(b.x + c.x - lambda * bc.y,
                          b.y + c.y + lambda * bc.x);
    center.x *= 0.5;
    center.y *= 0.5;

    let a_center = new Vec2(a.x - center.x, a.y - center.y);
    let radius = abs_v2(a_center, 0);
    let start_angle = Math.atan2(a_center.y, a_center.x);
    let end_angle = Math.atan2(c.y - center.y, c.x - center.x);

    return new Arc(center, radius, start_angle, end_angle, cross < 0);
}

function arrow_head_on_arc_end(arc, width, height)
{
    let dir = new Vec2(-Math.sin(arc.end_angle), Math.cos(arc.end_angle));
    let start = new Vec2(arc.center.x + arc.radius * dir.y, arc.center.y - arc.radius * dir.x);

    if (!arc.is_counter_clockwise)
    {
        dir.x = -dir.x;
        dir.y = -dir.y;
    }

    return make_arrow_head(start, dir, width, height);
}

function make_arrow_head(start, dir, width, height)
{
    let half_base = new Vec2(start.x + dir.x * height, start.y + dir.y * height);
    let corner0 = new Vec2(half_base.x - dir.y * width / 2, half_base.y + dir.x * width / 2);
    let corner1 = new Vec2(half_base.x + dir.y * width / 2, half_base.y - dir.x * width / 2);

    return new Triangle(start, corner0, corner1);
}

function draw_arc_between_two_points(start, end, height)
{
    let middle = new Vec2(start.y - end.y, end.x - start.x);
    let dist = height / abs_v2(middle, 0);

    middle.x *= dist;
    middle.y *= dist;
    middle.x += 0.5 * (start.x + end.x);
    middle.y += 0.5 * (start.y + end.y);

    let arc = arc_through_three_points(start, middle, end);
    let arc_margin = arc.end_angle - arc.start_angle;

    if (arc_margin > 0)
        arc_margin = 2 * Math.PI - arc_margin;
    else
        arc_margin = -arc_margin;
    arc_margin /= 10;

    arc.start_angle -= arc_margin;
    arc.end_angle += arc_margin;

    let head = arrow_head_on_arc_end(arc, 8, 8);
    arc.draw();
    head.draw();
}

function draw_line_between_two_points(start, end)
{
    start = new Vec2(start.x, start.y);
    end = new Vec2(end.x, end.y);

    let dir = new Vec2(end.x - start.x, end.y - start.y);

    dir.x /= 10;
    dir.y /= 10;

    start.x += dir.x;
    start.y += dir.y;
    end.x -= dir.x;
    end.y -= dir.y;

    dir.normalize();
    dir.x = -dir.x;
    dir.y = -dir.y;

    let head = make_arrow_head(end, dir, 8, 8);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    head.draw();
}

function draw_point(center)
{
    let old_style = ctx.fillStyle;
    ctx.fillStyle = "rgb(255, 0, 0)";
    ctx.beginPath()
    ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = old_style;
}

function main()
{
    canvas.width = 800;
    canvas.height = 600;
    ctx.imageSmoothingQuality = "high";

    let old_style = ctx.fillStyle;
    ctx.fillStyle = 'rgb(190, 190, 190)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    ctx.fillStyle = old_style;

    const ideal_length = 40;

    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(20 + ideal_length, 20);
    ctx.stroke();

    let adj_list = [[1, 2], [1, 3, 4], [5, 6], [], [6, 7], [], [1, 8, 9], [], [], [6, 10], []];
    let graph = graph_from_adjacency_list(adj_list);
    randomly_distribute_nodes(graph, canvas.width, canvas.height, 50, 50);
    layout_nodes(graph, 1000, 1, ideal_length);
    graph.draw();
}

main();
