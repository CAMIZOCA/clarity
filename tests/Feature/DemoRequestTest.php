<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_request_can_be_created(): void
    {
        $response = $this->postJson('/demo-request', [
            'name' => 'Andrea Morales',
            'company' => 'Optica Centro',
            'email' => 'andrea@example.com',
            'phone' => '+593 99 123 4567',
            'city' => 'Quito',
            'branches_count' => '2-3',
            'interests' => ['Pacientes e historia clinica', 'Inventario'],
            'message' => 'Queremos revisar agenda e inventario.',
            'privacy_accepted' => true,
        ]);

        $response->assertCreated()
            ->assertJson(['message' => 'Solicitud registrada correctamente.']);

        $this->assertDatabaseHas('demo_requests', [
            'email' => 'andrea@example.com',
            'company' => 'Optica Centro',
            'status' => 'new',
            'source' => 'landing',
        ]);
    }

    public function test_demo_request_requires_valid_contact_data(): void
    {
        $response = $this->postJson('/demo-request', [
            'name' => 'A',
            'company' => '',
            'email' => 'correo-invalido',
            'phone' => 'abc',
            'privacy_accepted' => false,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'company', 'email', 'phone', 'privacy_accepted']);
    }
}
