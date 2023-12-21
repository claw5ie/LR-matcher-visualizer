import { Vec2, abs_v2, cross_v2, dot_v2 } from './utils.js';

Module.onRuntimeInitialized = function() {
    init();
}

class DrawingContext
{
    ctx;
    animation_objects;
    finished_objects;

    constructor(ctx)
    {
        this.ctx = ctx;
        this.animation_objects = [];
        this.finished_objects = [];
    }

    clear()
    {
        this.animation_objects = [];
        this.finished_objects = [];
    }

    draw(dt)
    {
        for (let obj of this.finished_objects)
            obj.draw(this.ctx);

        let all_done = true;

        for (let obj of this.animation_objects)
        {
            obj.completion += dt / obj.time;
            obj.completion = Math.min(obj.completion, 1);
            obj.draw(this.ctx);
            all_done = (obj.completion >= 1) && all_done;
        }

        if (all_done)
        {
            this.finished_objects.push.apply(this.finished_objects, this.animation_objects);
            this.animation_objects = [];
        }

        return all_done;
    }
};

const pda_execution_canvas = document.getElementById('pda_execution');
const pda_graph_canvas = document.getElementById('pda_graph');

const pda_execution_ctx = pda_execution_canvas.getContext('2d');
const pda_graph_ctx = pda_graph_canvas.getContext('2d');

const pda_execution_dc = new DrawingContext(pda_execution_ctx);
const pda_graph_dc = new DrawingContext(pda_graph_ctx);

let g_last_time = 0;
let g_dt = 0;

let g_pda_ctx = undefined;
let g_pda = undefined;
let g_graph = undefined;

class ParseTreeNode
{
    text;
    box;
    children;

    constructor(text, box, children)
    {
        this.text = text;
        this.box = box;
        this.children = children;
    }
};

class Box
{
    x;
    y;
    width;
    height;

    constructor(x, y, width, height)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
};

class PDA
{
    string;
    stack;
    consumed;
    it;

    font;
    height;
    xspacing;
    yspacing;
    node_start;
    font_as_string;

    constructor(string, it)
    {
        this.string = string;
        this.stack = [];
        this.consumed = 0;
        this.it = it;

        this.font = 'Ubuntu Mono';
        this.height = 40;
        this.xspacing = 50;
        this.yspacing = 38;
        this.node_start = new Vec2(10, this.height);
        this.font_as_string = this.height + 'px ' + this.font;
    }

    shift(ctx, info)
    {
        let text = this.string[this.consumed++];
        let width = ctx.measureText(text).width;
        let node = new ParseTreeNode(text, new Box(this.node_start.x, this.node_start.y, width, this.height), []);

        this.stack.push(node);
        this.node_start.x += width + this.xspacing;

        return node;
    }

    // TODO: Implement a different style of graph: when all terminal nodes are on the same line.
    reduce(ctx, info)
    {
        let text = info.symbol;
        let count = this.stack.length;
        let children = this.stack.splice(count - info.count, info.count);
        let width = ctx.measureText(text).width;

        {
            let min_width = Number.MAX_VALUE;
            let max_width = Number.MIN_VALUE;

            for (let subnode of children)
            {
                min_width = Math.min(min_width, subnode.box.x);
                max_width = Math.max(max_width, subnode.box.x + subnode.box.width);
            }

            this.node_start.x = min_width + (max_width - min_width) / 2 - width / 2;
            this.node_start.y += this.height + this.yspacing;
        }

        let node = new ParseTreeNode(text, new Box(this.node_start.x, this.node_start.y, width, this.height), children);

        this.stack.push(node);
        this.node_start.x += width + this.xspacing;

        return node;
    }

    step(exec_dc, graph_dc)
    {
        let info = this.it.next().value;

        if (info == undefined)
            return;
        else if (typeof info === "boolean")
            return;

        switch (info.type)
        {
            case 's':
            {
                let node = this.shift(exec_dc.ctx, info);

                exec_dc.animation_objects =  [new AnimationObject('text', 500, { text: node.text, box: node.box, font: this.font_as_string })];
            } break;
            case 'g':
            {
                // TODO: implement goto.
            } break;
            case 'r':
            {
                let node = this.reduce(exec_dc.ctx, info);

                let objects = [];
                objects.push(new AnimationObject('text', 500, { text: node.text, box: new Vec2(node.box.x, node.box.y), font: this.font_as_string }));

                let mid_point0 = new Vec2(node.box.x + node.box.width / 2,
                                          node.box.y - node.box.height);
                for (let subnode of node.children)
                {
                    let start = new Vec2(mid_point0.x, mid_point0.y - 10);
                    let end = new Vec2(subnode.box.x + subnode.box.width / 2, subnode.box.y + 10);
                    objects.push(new AnimationObject('line', 800, { start: end, end: start }));
                }

                exec_dc.animation_objects = objects;
            } break;
        }
    }
};

class AnimationObject
{
    type;
    data;
    time;
    completion;

    constructor(type, time, data)
    {
        this.type = type;
        this.data = data;
        this.time = time;
        this.completion = 0;
    }

    draw(ctx)
    {
        switch (this.type)
        {
            case 'line':
            {
                let data = this.data;
                let dir = new Vec2((data.end.x - data.start.x) * this.completion,
                                   (data.end.y - data.start.y) * this.completion);

                ctx.fillStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(data.start.x, data.start.y);
                ctx.lineTo(data.start.x + dir.x, data.start.y + dir.y);
                ctx.stroke();
            } break;
            case 'text':
            {
                let data = this.data;

                ctx.fillStyle = '#000000';
                ctx.font = data.font;
                ctx.fillText(data.text, data.box.x, data.box.y);
            } break;
        }
    }
};

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

    draw(ctx)
    {
        for (let edge of this.edges)
        {
            let src = edge / this.nodes.length | 0;
            let dst = edge % this.nodes.length;

            if (this.are_connected(dst, src))
                draw_arc_between_two_points(ctx, this.nodes[src].pos, this.nodes[dst].pos, 12);
            else
                draw_line_between_two_points(ctx, this.nodes[src].pos, this.nodes[dst].pos);
        }

        for (let node of this.nodes)
            draw_point(ctx, node.pos);
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

    draw(ctx)
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

    draw(ctx)
    {
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.radius, this.start_angle, this.end_angle, this.is_counter_clockwise);
        ctx.stroke();
    }
};

function clear_canvas(ctx)
{
    let old_style = ctx.fillStyle;
    ctx.fillStyle = '#E6E6E6';
    ctx.beginPath();
    ctx.rect(0, 0, pda_execution_canvas.width, pda_execution_canvas.height);
    ctx.fill();
    ctx.fillStyle = old_style;
}

function graph_from_adjacency_list(adjacency_list)
{
    let graph = new Graph([], new Set());

    let src = 0;
    for (let neighboors of adjacency_list)
    {
        for (let edge of neighboors)
        {
            graph.edges.add(src * adjacency_list.length + edge.dst);
        }

        graph.nodes.push(new GraphNode(new Vec2(0, 0)));
        ++src;
    }

    return graph;
}

function randomly_distribute_nodes(graph, startx, endx, starty, endy)
{
    for (let node of graph.nodes)
    {
        let x = Math.random();
        let y = Math.random();
        x *= endx - startx;
        y *= endy - starty;
        x += startx;
        y += starty;
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

function resize_graph(graph, new_xlow, new_xhigh, new_ylow, new_yhigh)
{
    let xlow = Number.MAX_VALUE;
    let ylow = Number.MAX_VALUE;
    let xhigh = -Number.MAX_VALUE;
    let yhigh = -Number.MAX_VALUE;

    for (let node of graph.nodes)
    {
        xlow = Math.min(xlow, node.pos.x);
        ylow = Math.min(ylow, node.pos.y);
        xhigh = Math.max(xhigh, node.pos.x);
        yhigh = Math.max(yhigh, node.pos.y);
    }

    let x_aspect_ratio = (new_xhigh - new_xlow) / (xhigh - xlow);
    let y_aspect_ratio = (new_yhigh - new_ylow) / (yhigh - ylow);

    for (let node of graph.nodes)
    {
        let p = node.pos;
        p.x = (p.x - xlow) * x_aspect_ratio + new_xlow;
        p.y = (p.y - ylow) * y_aspect_ratio + new_ylow;
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

function draw_arc_between_two_points(ctx, start, end, height)
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
    arc.draw(ctx);
    head.draw(ctx);
}

function draw_line_between_two_points(ctx, start, end)
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
    head.draw(ctx);
}

function draw_point(ctx, center)
{
    let old_style = ctx.fillStyle;
    ctx.fillStyle = '#FF0000';
    ctx.beginPath()
    ctx.arc(center.x, center.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = old_style;
}

function create_parsing_table_from_string(input, use_bnf)
{
    window.requestAnimationFrame(function (timestamp) {
        if (g_pda_ctx)
            g_pda_ctx.delete();

        g_pda_ctx = Module.compute_parsing_table(input, use_bnf);

        let json = Module.generate_automaton_json(g_pda_ctx);
        let adjecency_list = JSON.parse(json);
        g_graph = graph_from_adjacency_list(adjecency_list);
        randomly_distribute_nodes(g_graph, 25, pda_graph_canvas.width - 25, 25, pda_graph_canvas.height - 25);
        layout_nodes(g_graph, 1000, 1, 40);
        resize_graph(g_graph, 25, pda_graph_canvas.width - 25, 25, pda_graph_canvas.height - 25);

        pda_graph_dc.clear();

        draw(timestamp);
    });
}

function match_string(input)
{
    window.requestAnimationFrame(function (timestamp) {
        let json = Module.generate_automaton_steps_json(g_pda_ctx, input);
        let steps = JSON.parse(json);
        g_pda = new PDA(input, steps[Symbol.iterator]());

        pda_execution_dc.clear();

        draw(timestamp);
    });
}

function init()
{
    pda_execution_canvas.width = 800;
    pda_execution_canvas.height = 600;

    pda_graph_canvas.width = 800;
    pda_graph_canvas.height = 600;

    let use_bnf_checkbox = document.getElementById('use_bnf_checkbox');
    let context_free_grammar_text_area = document.getElementById('context_free_grammar_text_area');
    let accept_context_free_grammar = document.getElementById('accept_context_free_grammar');
    accept_context_free_grammar.onclick = function() {
        create_parsing_table_from_string(context_free_grammar_text_area.value, use_bnf_checkbox.checked);
    };

    let pda_input = document.getElementById('pda_input');
    let accept_pda_input = document.getElementById('accept_pda_input');
    accept_pda_input.onclick = function() {
        match_string(pda_input.value);
    };

    accept_context_free_grammar.onclick();

    window.requestAnimationFrame(draw);
}

function draw(current_time)
{
    g_dt = current_time - g_last_time;
    g_last_time = current_time;

    clear_canvas(pda_execution_ctx);
    clear_canvas(pda_graph_ctx);

    let all_done = pda_execution_dc.draw(g_dt);
    all_done = pda_graph_dc.draw(g_dt) && all_done;

    if (all_done && g_pda)
        g_pda.step(pda_execution_dc, pda_graph_dc);

    if (g_graph)
        g_graph.draw(pda_graph_ctx);

    window.requestAnimationFrame(draw);
}
