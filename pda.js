import { Vec2 } from './utils.js';

const parse_tree_canvas = document.getElementById('parse_tree');
const parse_tree_ctx = parse_tree_canvas.getContext('2d');

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

        this.font = "Ubuntu Mono";
        this.height = 40;
        this.xspacing = 50;
        this.yspacing = 38;
        this.node_start = new Vec2(0, this.height);
        this.font_as_string = this.height + "px " + this.font;
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

    step(ctx)
    {
        let info = this.it.next().value;

        if (info == undefined)
            return [];

        switch (info.type)
        {
            case 'shift':
            {
                let node = this.shift(ctx);

                return [new AnimationObject(ctx, 'text', 500, { text: node.text, box: node.box, font: this.font_as_string })];
            } break;
            case 'reduce':
            {
                let node = this.reduce(ctx, info.to);

                let objects = [];
                objects.push(new AnimationObject(ctx, 'text', 500, { text: node.text, box: new Vec2(node.box.x, node.box.y), font: this.font_as_string }));

                let mid_point0 = new Vec2(node.box.x + node.box.width / 2,
                                          node.box.y - node.box.height);
                for (let subnode of node.children)
                {
                    let start = new Vec2(mid_point0.x, mid_point0.y - 10);
                    let end = new Vec2(subnode.box.x + subnode.box.width / 2, subnode.box.y + 10);
                    objects.push(new AnimationObject(ctx, 'line', 800, { start: end, end: start }));
                }

                return objects;
            } break;
            case 'finish':
            {
                return [];
            } break;
        }
    }
};

class AnimationObject
{
    ctx;
    type;
    data;
    time;
    completion;

    constructor(ctx, type, time, data)
    {
        this.ctx = ctx;
        this.type = type;
        this.data = data;
        this.time = time;
        this.completion = 0;
    }

    draw()
    {
        switch (this.type)
        {
            case 'line':
            {
                let data = this.data;
                let dir = new Vec2((data.end.x - data.start.x) * this.completion,
                                   (data.end.y - data.start.y) * this.completion);

                this.ctx.fillStyle = '#000000';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(data.start.x, data.start.y);
                this.ctx.lineTo(data.start.x + dir.x, data.start.y + dir.y);
                this.ctx.stroke();
            } break;
            case 'text':
            {
                let data = this.data;

                this.ctx.fillStyle = '#000000';
                this.ctx.font = data.font;
                this.ctx.fillText(data.text, data.box.x, data.box.y);
            } break;
        }
    }
};

class DrawingContext
{
    pda;
    last_time;
    dt;
    animation_objects;
    finished_objects;

    constructor()
    {
        this.reset();
    }

    reset()
    {
        this.pda = undefined;
        this.last_time = 0;
        this.dt = 0;
        this.animation_objects = [];
        this.finished_objects = [];
    }

    draw_pda_from_file(filepath)
    {
        fetch(filepath)
            .then((file) => file.json())
            .then((steps) => {
                this.reset();
                this.pda = new PDA(steps.string, steps.actions[Symbol.iterator]());
                window.requestAnimationFrame(draw);
            });
    }
};

function draw_pda_from_file(form)
{
    dc.draw_pda_from_file('./automatons/' + form.text_box.value);
}

const dc = new DrawingContext();

function init()
{
    parse_tree_canvas.width = 800;
    parse_tree_canvas.height = 600;

    dc.draw_pda_from_file('./automatons/steps1.json');
}

function clear_canvas(ctx, current_time)
{
    dc.dt = current_time - dc.last_time;
    dc.last_time = current_time;

    {
        let old_style = ctx.fillStyle;
        ctx.fillStyle = '#E6E6E6';
        ctx.beginPath();
        ctx.rect(0, 0, parse_tree_canvas.width, parse_tree_canvas.height);
        ctx.fill();
        ctx.fillStyle = old_style;
    }
}

function draw(current_time)
{
    clear_canvas(parse_tree_ctx, current_time);

    for (let obj of dc.finished_objects)
        obj.draw();

    if (dc.animation_objects.length > 0)
    {
        let all_done = true;

        for (let obj of dc.animation_objects)
        {
            obj.completion += dc.dt / obj.time;
            obj.completion = Math.min(obj.completion, 1);
            obj.draw();
            all_done = (obj.completion >= 1) && all_done;
        }

        if (all_done)
        {
            dc.finished_objects.push.apply(dc.finished_objects, dc.animation_objects);
            dc.animation_objects = [];
        }
    }
    else
    {
        dc.animation_objects = dc.pda.step(parse_tree_ctx);
    }

    window.requestAnimationFrame(draw);
}

init();
