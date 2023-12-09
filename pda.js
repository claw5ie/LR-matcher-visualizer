import { Vec2 } from './utils.js';

const canvas = document.getElementById('parse_tree');
const ctx = canvas.getContext('2d');

class ParseTreeNode
{
    constructor(text, bounding_box)
    {
        this.text = text;
        this.box = bounding_box;
        this.children = [];
    }
};

class Box
{
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
    constructor(string, it)
    {
        this.string = string;
        this.stack = [];
        this.consumed = 0;
        this.last_pos = new Vec2(20, 50);
        this.xspacing = 50;
        this.yspacing = 70;
        this.it = it;
    }

    shift()
    {
        let text = this.string[this.consumed++];
        let node = new ParseTreeNode(text, box_from_measure(this.last_pos, ctx.measureText(text)));
        this.stack.push(node);
        this.last_pos.x += node.box.width + this.xspacing;

        return [new AnimationObject('text', 500, { text: text, box: new Vec2(node.box.x, node.box.y) })];
    }

    reduce(info)
    {
        let text = info.symbol;
        let size = this.stack.length;
        let children = this.stack.splice(size - info.size, info.size);

        let min_width = Number.MAX_VALUE;
        let max_width = Number.MIN_VALUE;
        for (let node of children)
        {
            min_width = Math.min(min_width, node.box.x);
            max_width = Math.max(max_width, node.box.x + node.box.width);
        }

        let measure = ctx.measureText(text);
        this.last_pos.x = min_width + (max_width - min_width) / 2 - measure.width / 2;
        this.last_pos.y += this.yspacing;

        let node = new ParseTreeNode(text, box_from_measure(this.last_pos, measure));
        node.children = children;
        this.stack.push(node);

        this.last_pos.x += node.box.width + this.xspacing;

        let objects = [];

        {
            objects.push(new AnimationObject('text', 500, { text: text, box: new Vec2(node.box.x, node.box.y) }));

            let mid_point0 = new Vec2(node.box.x + node.box.width / 2,
                                      node.box.y - node.box.height);
            for (let subnode of node.children)
            {
                let start = new Vec2(mid_point0.x, mid_point0.y - 10);
                let end = new Vec2(subnode.box.x + subnode.box.width / 2, subnode.box.y + 10);
                objects.push(new AnimationObject('line', 800, { start: end, end: start }));
            }
        }

        return objects;
    }

    step()
    {
        let info = this.it.next().value;

        if (info == undefined)
            return [];

        switch (info.type)
        {
            case 'shift':
            {
                return this.shift();
            } break;
            case 'reduce':
            {
                return this.reduce(info.to);
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
    constructor(type, time, data)
    {
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

                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.moveTo(data.start.x, data.start.y);
                ctx.lineTo(data.start.x + dir.x, data.start.y + dir.y);
                ctx.stroke();
            } break;
            case 'text':
            {
                let data = this.data;

                ctx.fillStyle = '#000000';
                ctx.fillText(data.text, data.box.x, data.box.y);
            } break;
        }
    }
};

function box_from_measure(pos, measure)
{
    let height = measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent;
    return new Box(pos.x, pos.y, measure.width, height);
}

class DrawingContext
{
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
    canvas.width = 800;
    canvas.height = 600;
    ctx.font = '32px Iosevka ss12';

    dc.draw_pda_from_file('./automatons/steps1.json');
}

function clear_canvas(current_time)
{
    dc.dt = current_time - dc.last_time;
    dc.last_time = current_time;

    {
        let old_style = ctx.fillStyle;
        ctx.fillStyle = '#E6E6E6';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fill();
        ctx.fillStyle = old_style;
    }
}

function draw(current_time)
{
    clear_canvas(current_time);

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
        dc.animation_objects = dc.pda.step();
    }

    window.requestAnimationFrame(draw);
}

init();
