from mongoengine import Document, fields
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token


class Datas(Document):
    timestamp = fields.IntField(required=True, unique=True)
    data = fields.ListField(fields.FloatField(), required=True)
    userId = fields.IntField()
    # userId = fields.IntField(unique_with=timestamp)

    meta = {
        'strict': False,
    }


class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.user.username


class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.user.username


@receiver(post_save, sender=Patient)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    print(sender, instance, created, kwargs)
    if created:
        Token.objects.create(user=instance.user)
