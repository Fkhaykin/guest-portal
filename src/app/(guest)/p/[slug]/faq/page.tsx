import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";

export default async function FaqPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!property) notFound();

  const { data: faqs } = await supabase
    .from("faq")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  // Group by category
  const categories = new Map<string, typeof faqs>();
  faqs?.forEach((faq) => {
    const cat = faq.category || "General";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(faq);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your stay"
        title="Frequently asked questions"
        titleClassName="font-display text-display"
        description="Everything you need to know about your stay."
      />

      {categories.size > 0 ? (
        Array.from(categories.entries()).map(([category, items]) => (
          <section key={category} className="space-y-3">
            {categories.size > 1 && <SectionHeader title={category} />}
            {/* The list sat on the page canvas as an undifferentiated wall of
                rules; a card gives each category a surface of its own. */}
            <Card size="sm" className="gap-0 py-0">
              <Accordion className="w-full px-4">
                {items?.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="whitespace-pre-wrap text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </section>
        ))
      ) : (
        <EmptyState
          icon={HelpCircle}
          title="No FAQs available yet"
          description="Questions and answers about your stay will appear here once they're added."
        />
      )}
    </div>
  );
}
