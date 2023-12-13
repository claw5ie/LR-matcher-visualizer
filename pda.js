import { Vec2 } from './utils.js';

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

let g_pda = undefined;

let g_dont_draw = false;

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

    shift(ctx)
    {
        let text = this.string[this.consumed++];
        let width = ctx.measureText(text).width;
        let node = new ParseTreeNode(text, new Box(this.node_start.x, this.node_start.y, width, this.height), []);

        this.stack.push(node);
        this.node_start.x += width + this.xspacing;

        return node;
    }

    reduce(ctx, info)
    {
        let text = info.symbol;
        let size = this.stack.length;
        let children = this.stack.splice(size - info.size, info.size);
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

        switch (info.type)
        {
            case 'shift':
            {
                let node = this.shift(exec_dc.ctx);

                exec_dc.animation_objects =  [new AnimationObject('text', 500, { text: node.text, box: node.box, font: this.font_as_string })];
            } break;
            case 'reduce':
            {
                let node = this.reduce(exec_dc.ctx, info.to);

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
            case 'finish':
            break;
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

function setup_before_first_frame(filename)
{
    g_last_time = 0;
    g_dt = 0;

    g_dont_draw = true;
    pda_execution_dc.clear()
    pda_graph_dc.clear();

    fetch('./PDAs/' + filename)
        .then((file) => file.json())
        .then((steps) => {
            g_pda = new PDA(steps.string, steps.actions[Symbol.iterator]());
            // Does this fully prevent from drawing parts of previous automaton? It is possible that there are more frames in between this and next instruction.
            g_dont_draw = false;
            window.requestAnimationFrame(draw);
        });
}

function init()
{
    pda_execution_canvas.width = 800;
    pda_execution_canvas.height = 600;

    pda_graph_canvas.width = 800;
    pda_graph_canvas.height = 600;

    const form = document.getElementById('pda_file_form');
    form.redraw_button.onclick = function() {
        setup_before_first_frame(form.text_box.value);
    };

    setup_before_first_frame('pda1.json');
}

function clear_canvas(ctx)
{
    let old_style = ctx.fillStyle;
    ctx.fillStyle = '#E6E6E6';
    ctx.beginPath();
    ctx.rect(0, 0, pda_execution_canvas.width, pda_execution_canvas.height);
    ctx.fill();
    ctx.fillStyle = old_style;
}

function draw(current_time)
{
    if (g_dont_draw)
        return;

    g_dt = current_time - g_last_time;
    g_last_time = current_time;

    clear_canvas(pda_execution_ctx);
    clear_canvas(pda_graph_ctx);

    let all_done = pda_execution_dc.draw(g_dt);
    all_done = pda_graph_dc.draw(g_dt) && all_done;

    if (all_done)
        g_pda.step(pda_execution_dc, pda_graph_dc);

    window.requestAnimationFrame(draw);
}

init();
