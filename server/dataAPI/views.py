import json
from django.shortcuts import render, redirect
from django.http import HttpResponseNotFound
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import messages
from django.core.exceptions import ObjectDoesNotExist

from .models import Doctor, Patient


@login_required
def medical(request):
    # Only for medical users. Patients are not allowed
    try:
        doctor = Doctor.objects.get(user_id=request.user.id)
    except ObjectDoesNotExist:
        logout(request)
        return redirect("login")
    if request.method == 'GET':
        patients_list = Patient.objects.filter(
            doctor_id__user_id=request.user.id)
        return render(request, 'dr.html', {'patients': patients_list})
    else:
        return HttpResponseNotFound()


def login_request(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                messages.info(request, f"You are now logged in as {username}.")
                return redirect("medical")
            else:
                messages.error(request, "Invalid username or password.")
        else:
            messages.error(request, "Invalid username or password.")
    form = AuthenticationForm()
    return render(request=request, template_name="login.html", context={"login_form": form})
