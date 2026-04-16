import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { SortablePropertiesGrid } from "@/components/admin/sortable-properties-grid";

export default async function PropertiesListPage() {
  const supabase = await createClient();

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .single();

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, slug, address, cover_image_url, is_active, sort_order")
    .eq("host_id", host?.id ?? "")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage your rental properties — drag to reorder</p>
        </div>
        <Link href="/admin/properties/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </Link>
      </div>

      {properties && properties.length > 0 ? (
        <SortablePropertiesGrid properties={properties} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No properties yet. Add your first property to get started.
            </p>
            <Link href="/admin/properties/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
