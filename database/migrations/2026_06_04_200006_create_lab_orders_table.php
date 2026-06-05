<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Proveedores de laboratorio (diferente a proveedores de productos)
        Schema::create('lab_suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('ruc', 13)->nullable();
            $table->string('contact_name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address', 250)->nullable();
            $table->unsignedTinyInteger('turnaround_days')->default(5); // Días promedio de entrega
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Órdenes de laboratorio
        Schema::create('lab_orders', function (Blueprint $table) {
            $table->id();

            // Número auto-generado: LB-2026-00001
            $table->string('order_number', 20)->unique();

            // Relaciones
            $table->foreignId('sale_id')->nullable()->constrained('sales')->onDelete('set null');
            $table->foreignId('patient_id')->nullable()->constrained('patients')->onDelete('set null');
            $table->foreignId('consultation_id')->nullable()->constrained('consultations')->onDelete('set null');
            $table->foreignId('lab_supplier_id')->nullable()->constrained('lab_suppliers')->onDelete('set null');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null'); // Encargado
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');

            // Estado
            $table->enum('status', [
                'draft',       // Borrador
                'pending',     // Pendiente envío
                'sent',        // Enviado al laboratorio
                'processing',  // En proceso en laboratorio
                'received',    // Recibido en óptica
                'qc',          // Control de calidad
                'ready',       // Listo para entrega
                'delivered',   // Entregado al cliente
                'reprocess',   // Reproceso (falla en QC)
                'cancelled',   // Cancelado
            ])->default('draft');

            $table->enum('priority', ['normal', 'urgent'])->default('normal');

            // Datos de la receta para el laboratorio (snapshot al momento de crear la orden)
            $table->decimal('od_sphere', 6, 2)->nullable();
            $table->decimal('od_cylinder', 6, 2)->nullable();
            $table->decimal('od_axis', 5, 1)->nullable();
            $table->decimal('od_add', 5, 2)->nullable();
            $table->decimal('od_prism', 5, 2)->nullable();
            $table->decimal('oi_sphere', 6, 2)->nullable();
            $table->decimal('oi_cylinder', 6, 2)->nullable();
            $table->decimal('oi_axis', 5, 1)->nullable();
            $table->decimal('oi_add', 5, 2)->nullable();
            $table->decimal('oi_prism', 5, 2)->nullable();
            $table->decimal('pd_far', 5, 1)->nullable();      // DP visión lejana
            $table->decimal('pd_near', 5, 1)->nullable();     // DP visión cercana
            $table->decimal('height_od', 5, 1)->nullable();   // Altura OD
            $table->decimal('height_oi', 5, 1)->nullable();   // Altura OI

            // Descripción del producto
            $table->string('frame_description', 200)->nullable(); // "Armazón XYZ color negro"
            $table->string('lens_type', 60)->nullable();           // "Progresivo"
            $table->string('lens_material', 60)->nullable();       // "1.67"
            $table->string('lens_treatment', 150)->nullable();     // "AR + UV + Blue-Cut"
            $table->string('lens_design', 60)->nullable();

            // Gestión de tiempos
            $table->date('estimated_delivery_date')->nullable();
            $table->date('actual_delivery_date')->nullable();

            // Financiero
            $table->decimal('lab_cost', 10, 2)->default(0); // Costo cobrado por el laboratorio

            // Notas
            $table->text('technical_notes')->nullable(); // Instrucciones técnicas para el lab
            $table->text('internal_notes')->nullable();  // Notas internas de la óptica
            $table->text('reprocess_reason')->nullable(); // Razón del reproceso

            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('status');
            $table->index('patient_id');
            $table->index('sale_id');
            $table->index('lab_supplier_id');
            $table->index('branch_id');
            $table->index('assigned_to');
            $table->index('estimated_delivery_date');
            $table->index(['status', 'estimated_delivery_date']); // Para alertas de atraso
        });

        // Historial de cambios de estado de órdenes
        Schema::create('lab_order_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lab_order_id')->constrained('lab_orders')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->string('old_status', 30)->nullable();
            $table->string('new_status', 30);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('lab_order_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_order_history');
        Schema::dropIfExists('lab_orders');
        Schema::dropIfExists('lab_suppliers');
    }
};
