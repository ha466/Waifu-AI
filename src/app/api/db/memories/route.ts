import { NextResponse } from 'next/server';
import prisma from '~/lib/db';

export async function GET() {
  try {
    const memories = await prisma.memoryFact.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(memories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { content } = await req.json();
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

    const memory = await prisma.memoryFact.create({ data: { content } });
    return NextResponse.json(memory);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, content } = await req.json();
    if (!id || !content) return NextResponse.json({ error: "id and content required" }, { status: 400 });

    const memory = await prisma.memoryFact.update({
      where: { id },
      data: { content }
    });
    return NextResponse.json(memory);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.memoryFact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
