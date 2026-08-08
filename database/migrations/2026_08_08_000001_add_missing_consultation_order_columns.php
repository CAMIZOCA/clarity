<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Completa las columnas del bloque de pedido de lentes que
 * 2026_05_28_000002_add_import_fields_to_consultations nunca llego a crear.
 *
 * Aquella migracion se quedo sin espacio de fila a mitad de camino. El DDL en
 * MySQL/MariaDB no es transaccional, asi que las columnas que ya habia creado
 * quedaron aplicadas; al reintentar, su guarda de idempotencia vio que la
 * PRIMERA columna (`legacy_id`) existia, retorno de inmediato y Laravel la dio
 * por ejecutada. Resultado: migracion registrada como exitosa con el esquema
 * incompleto y cinco columnas ausentes.
 *
 * Se agregan como TEXT en vez de VARCHAR(100) para no volver a rozar el limite
 * de fila; la longitud se valida en la capa de aplicacion.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();
        $isMysql = in_array($driver, ['mysql', 'mariadb'], true);

        // Por si esta migracion corre sobre una base donde la reduccion de fila
        // no alcanzo a cubrir alguna columna (por ejemplo `estado_lentes`, que
        // nace en la migracion que fallo y por tanto no existia antes).
        if ($isMysql) {
            foreach (['estado_lentes', 'tipo_lentes', 'color_lentes', 'bifocal'] as $column) {
                if ($this->isVarchar('consultations', $column)) {
                    DB::statement("alter table `consultations` modify `{$column}` text null");
                }
            }
        }

        Schema::table('consultations', function (Blueprint $table) {
            if (! Schema::hasColumn('consultations', 'espesor')) {
                $table->text('espesor')->nullable();
            }
            if (! Schema::hasColumn('consultations', 'laboratorio_pedido')) {
                $table->text('laboratorio_pedido')->nullable();
            }
            if (! Schema::hasColumn('consultations', 'pedido_armazon')) {
                $table->text('pedido_armazon')->nullable();
            }
            if (! Schema::hasColumn('consultations', 'fecha_entrega')) {
                $table->date('fecha_entrega')->nullable();
            }
            if (! Schema::hasColumn('consultations', 'observacion_pedidos')) {
                $table->text('observacion_pedidos')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn([
                'espesor',
                'laboratorio_pedido',
                'pedido_armazon',
                'fecha_entrega',
                'observacion_pedidos',
            ]);
        });
    }

    private function isVarchar(string $table, string $column): bool
    {
        if (! Schema::hasColumn($table, $column)) {
            return false;
        }

        $row = DB::selectOne(
            'select data_type from information_schema.columns
             where table_schema = database() and table_name = ? and column_name = ?',
            [$table, $column]
        );

        return $row !== null && strtolower((string) $row->data_type) === 'varchar';
    }
};
