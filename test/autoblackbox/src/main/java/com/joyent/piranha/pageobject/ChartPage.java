package com.joyent.piranha.pageobject;


import org.openqa.selenium.By;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class ChartPage extends Usage{
    public Usage clickBackToUsage(){
        $(By.xpath("//*[@data-ng-switch=\"subview\"]/div/div/div/a[contains(@href,'usage')]")).click();
        return page(Usage.class);
    }
}
